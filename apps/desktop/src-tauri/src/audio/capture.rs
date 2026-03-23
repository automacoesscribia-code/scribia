use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::StreamConfig;
use hound::{WavSpec, WavWriter};
use serde::Serialize;
use std::io::BufWriter;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use super::devices::get_device_by_index;

#[derive(Clone, Debug, Serialize, PartialEq)]
pub enum CaptureState {
    Idle,
    Recording,
    Paused,
    Stopped,
}

#[derive(Serialize, Clone, Debug)]
pub struct CaptureStatus {
    pub state: CaptureState,
    pub duration_seconds: f64,
    pub audio_level: f32,
    pub chunks_saved: u32,
    pub output_dir: String,
}

/// Shared capture data — Send+Sync safe (no raw pointers)
pub struct SharedCaptureData {
    pub state: Mutex<CaptureState>,
    pub start_time: Mutex<Option<Instant>>,
    pub pause_offset: Mutex<f64>,
    pub audio_level: Mutex<f32>,
    pub writer: Mutex<Option<WavWriter<BufWriter<std::fs::File>>>>,
    pub chunk_count: Mutex<u32>,
    pub output_dir: Mutex<String>,
    pub sample_rate: Mutex<u32>,
    pub channels: Mutex<u16>,
}

impl SharedCaptureData {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(CaptureState::Idle),
            start_time: Mutex::new(None),
            pause_offset: Mutex::new(0.0),
            audio_level: Mutex::new(0.0),
            writer: Mutex::new(None),
            chunk_count: Mutex::new(0),
            output_dir: Mutex::new(String::new()),
            sample_rate: Mutex::new(44100),
            channels: Mutex::new(1),
        }
    }

    /// Reset all state to prepare for a new recording session
    pub fn reset(&self) {
        *self.state.lock().unwrap() = CaptureState::Idle;
        *self.start_time.lock().unwrap() = None;
        *self.pause_offset.lock().unwrap() = 0.0;
        *self.audio_level.lock().unwrap() = 0.0;
        // Finalize any leftover writer
        if let Some(w) = self.writer.lock().unwrap().take() {
            let _ = w.finalize();
        }
        *self.chunk_count.lock().unwrap() = 0;
        *self.output_dir.lock().unwrap() = String::new();
    }

    pub fn get_duration(&self) -> f64 {
        let offset = *self.pause_offset.lock().unwrap();
        let state = self.state.lock().unwrap().clone();
        let start = *self.start_time.lock().unwrap();
        match (state, start) {
            (CaptureState::Recording, Some(s)) => offset + s.elapsed().as_secs_f64(),
            _ => offset,
        }
    }

    pub fn get_status(&self) -> CaptureStatus {
        // Read all values into locals FIRST to avoid holding multiple locks simultaneously
        let state = self.state.lock().unwrap().clone();
        let duration_seconds = self.get_duration();
        let audio_level = *self.audio_level.lock().unwrap();
        let chunks_saved = *self.chunk_count.lock().unwrap() + 1;
        let output_dir = self.output_dir.lock().unwrap().clone();

        CaptureStatus {
            state,
            duration_seconds,
            audio_level,
            chunks_saved,
            output_dir,
        }
    }

    pub fn pause(&self) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        if *state != CaptureState::Recording {
            return Err("Not recording".into());
        }
        if let Some(start) = *self.start_time.lock().unwrap() {
            *self.pause_offset.lock().unwrap() += start.elapsed().as_secs_f64();
        }
        *state = CaptureState::Paused;
        Ok(())
    }

    pub fn resume(&self) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        if *state != CaptureState::Paused {
            return Err("Not paused".into());
        }
        *self.start_time.lock().unwrap() = Some(Instant::now());
        *state = CaptureState::Recording;
        Ok(())
    }

    pub fn stop(&self) -> Result<CaptureStatus, String> {
        // Signal stop first so audio callback exits quickly
        *self.state.lock().unwrap() = CaptureState::Stopped;

        // Small delay to let the audio callback finish its current iteration
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Now safely finalize the writer
        if let Some(w) = self.writer.lock().unwrap().take() {
            let _ = w.finalize();
        }

        let duration = self.get_duration();
        let chunks_saved = *self.chunk_count.lock().unwrap() + 1;
        let output_dir = self.output_dir.lock().unwrap().clone();

        *self.start_time.lock().unwrap() = None;
        *self.audio_level.lock().unwrap() = 0.0;

        Ok(CaptureStatus {
            state: CaptureState::Stopped,
            duration_seconds: duration,
            audio_level: 0.0,
            chunks_saved,
            output_dir,
        })
    }
}

/// Start capture — returns a cpal::Stream (NOT Send, keep on main thread)
/// If `custom_output_dir` is Some, use that path instead of temp dir.
pub fn start_capture_stream(
    shared: &Arc<SharedCaptureData>,
    device_index: usize,
    lecture_id: &str,
    custom_output_dir: Option<&str>,
) -> Result<cpal::Stream, String> {
    let device = get_device_by_index(device_index)?;
    let config = device
        .default_input_config()
        .map_err(|e| format!("No input config: {}", e))?;

    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    *shared.sample_rate.lock().unwrap() = sample_rate;
    *shared.channels.lock().unwrap() = channels;

    let temp_dir = if let Some(dir) = custom_output_dir {
        std::path::PathBuf::from(dir)
    } else {
        std::env::temp_dir().join("scribia").join(lecture_id)
    };
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("mkdir: {}", e))?;
    *shared.output_dir.lock().unwrap() = temp_dir.to_string_lossy().to_string();

    let spec = WavSpec {
        channels, sample_rate, bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let writer = WavWriter::create(temp_dir.join("chunk_0.wav"), spec)
        .map_err(|e| format!("WAV create: {}", e))?;
    *shared.writer.lock().unwrap() = Some(writer);
    *shared.chunk_count.lock().unwrap() = 0;

    let stream_config: StreamConfig = config.into();
    let chunk_samples = (sample_rate as u64) * (channels as u64) * 30;
    let counter = Arc::new(Mutex::new(0u64));
    let s = Arc::clone(shared);
    let c = Arc::clone(&counter);
    let d = temp_dir.clone();

    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Check state — use try_lock to avoid blocking the audio thread
                let is_recording = s.state.try_lock()
                    .map(|st| *st == CaptureState::Recording)
                    .unwrap_or(false);
                if !is_recording { return; }

                // Calculate audio level (RMS)
                if !data.is_empty() {
                    let rms = (data.iter().map(|&x| x * x).sum::<f32>() / data.len() as f32).sqrt();
                    if let Ok(mut level) = s.audio_level.try_lock() {
                        *level = (rms * 100.0).min(100.0);
                    }
                }

                // Write samples to WAV
                if let Ok(mut w) = s.writer.try_lock() {
                    if let Some(ref mut wr) = *w {
                        for &sample in data { let _ = wr.write_sample((sample * 32767.0) as i16); }
                    }
                }

                // Track sample count for chunk rotation
                if let Ok(mut cnt) = c.try_lock() {
                    *cnt += data.len() as u64;
                    if *cnt >= chunk_samples {
                        *cnt = 0;
                        if let Ok(mut cn) = s.chunk_count.try_lock() {
                            *cn += 1;
                            let path = d.join(format!("chunk_{}.wav", *cn));
                            let sr = s.sample_rate.try_lock().map(|v| *v).unwrap_or(44100);
                            let ch = s.channels.try_lock().map(|v| *v).unwrap_or(1);
                            let sp = WavSpec { channels: ch, sample_rate: sr, bits_per_sample: 16, sample_format: hound::SampleFormat::Int };
                            if let Ok(mut w) = s.writer.try_lock() {
                                if let Some(old) = w.take() { let _ = old.finalize(); }
                                if let Ok(nw) = WavWriter::create(path, sp) { *w = Some(nw); }
                            }
                        }
                    }
                }
            },
            |err| eprintln!("Audio error: {}", err),
            None,
        )
        .map_err(|e| format!("Build stream: {}", e))?;

    stream.play().map_err(|e| format!("Play: {}", e))?;

    *shared.state.lock().unwrap() = CaptureState::Recording;
    *shared.start_time.lock().unwrap() = Some(Instant::now());
    *shared.pause_offset.lock().unwrap() = 0.0;

    Ok(stream)
}
