mod audio;
mod upload;

use audio::capture::{CaptureStatus, SharedCaptureData, start_capture_stream};
use audio::devices::{list_audio_devices as enumerate_devices, AudioDevice};
use upload::manager::{UploadManager, UploadResult};

use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Manager, State};

/// App state managed by Tauri — Send + Sync
struct AppState {
    shared: Arc<SharedCaptureData>,
    capture_thread: Mutex<Option<thread::JoinHandle<()>>>,
}

/// Get the app data recordings directory.
/// Falls back to temp dir if app_data_dir is unavailable.
fn get_recordings_base(app: &AppHandle) -> PathBuf {
    match app.path().app_data_dir() {
        Ok(app_data) => {
            let recordings = app_data.join("recordings");
            if std::fs::create_dir_all(&recordings).is_ok() {
                return recordings;
            }
        }
        Err(e) => {
            eprintln!("Warning: app_data_dir failed ({}), using temp dir", e);
        }
    }
    // Fallback to temp dir
    let fallback = std::env::temp_dir().join("scribia").join("recordings");
    let _ = std::fs::create_dir_all(&fallback);
    fallback
}

#[tauri::command]
fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    enumerate_devices()
}

#[tauri::command]
fn start_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    device_index: usize,
    lecture_id: String,
    event_id: Option<String>,
) -> Result<String, String> {
    // Reset shared state from any previous recording
    state.shared.reset();

    // Wait for previous capture thread to finish
    if let Some(h) = state.capture_thread.lock().unwrap().take() {
        let _ = h.join();
    }

    // Determine output directory
    let eid = event_id.unwrap_or_else(|| "default".to_string());
    let base = get_recordings_base(&app);
    let output_dir = base.join(&eid).join(&lecture_id);
    std::fs::create_dir_all(&output_dir).map_err(|e| format!("Cannot create output dir: {}", e))?;

    let dir_str = output_dir.to_string_lossy().to_string();
    let shared = Arc::clone(&state.shared);
    let lid = lecture_id.clone();
    let dir_for_thread = dir_str.clone();

    let handle = thread::spawn(move || {
        let stream = match start_capture_stream(&shared, device_index, &lid, Some(&dir_for_thread)) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Capture error: {}", e);
                *shared.state.lock().unwrap() = audio::capture::CaptureState::Stopped;
                return;
            }
        };
        loop {
            thread::sleep(std::time::Duration::from_millis(100));
            if *shared.state.lock().unwrap() == audio::capture::CaptureState::Stopped {
                break;
            }
        }
        drop(stream);
    });

    *state.capture_thread.lock().unwrap() = Some(handle);
    Ok(dir_str)
}

#[tauri::command]
fn pause_capture(state: State<'_, AppState>) -> Result<(), String> {
    state.shared.pause()
}

#[tauri::command]
fn resume_capture(state: State<'_, AppState>) -> Result<(), String> {
    state.shared.resume()
}

#[tauri::command]
fn stop_capture(state: State<'_, AppState>) -> Result<CaptureStatus, String> {
    let result = state.shared.stop()?;
    if let Some(h) = state.capture_thread.lock().unwrap().take() { let _ = h.join(); }
    Ok(result)
}

#[tauri::command]
fn get_capture_status(state: State<'_, AppState>) -> CaptureStatus {
    state.shared.get_status()
}

#[tauri::command]
async fn upload_chunks(
    event_id: String,
    lecture_id: String,
    output_dir: String,
    supabase_url: String,
    supabase_key: String,
) -> Result<UploadResult, String> {
    let manager = UploadManager::new(supabase_url, supabase_key);
    manager.upload_all_chunks(&event_id, &lecture_id, &output_dir).await
}

#[derive(Serialize, Clone, Debug)]
pub struct LocalChunkInfo {
    pub exists: bool,
    pub chunk_count: u32,
    pub total_bytes: u64,
    pub output_dir: String,
}

#[tauri::command]
fn check_local_chunks(app: AppHandle, lecture_id: String, event_id: Option<String>) -> Result<LocalChunkInfo, String> {
    let eid = event_id.unwrap_or_else(|| "default".to_string());
    let base = get_recordings_base(&app);
    let lecture_dir = base.join(&eid).join(&lecture_id);

    if lecture_dir.exists() {
        return count_chunks(&lecture_dir);
    }

    // Fallback: check temp dir for backwards compatibility
    let temp_dir = std::env::temp_dir().join("scribia").join(&lecture_id);
    if temp_dir.exists() {
        return count_chunks(&temp_dir);
    }

    Ok(LocalChunkInfo { exists: false, chunk_count: 0, total_bytes: 0, output_dir: String::new() })
}

fn count_chunks(dir: &PathBuf) -> Result<LocalChunkInfo, String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut chunk_count: u32 = 0;
    let mut total_bytes: u64 = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "wav") {
            chunk_count += 1;
            total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }

    Ok(LocalChunkInfo {
        exists: chunk_count > 0,
        chunk_count,
        total_bytes,
        output_dir: dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            shared: Arc::new(SharedCaptureData::new()),
            capture_thread: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            list_audio_devices,
            start_capture,
            pause_capture,
            resume_capture,
            stop_capture,
            get_capture_status,
            upload_chunks,
            check_local_chunks,
            open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
