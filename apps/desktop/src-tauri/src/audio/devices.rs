use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct AudioDevice {
    pub name: String,
    pub device_type: String,
    pub index: usize,
}

pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    let input_devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {}", e))?;

    for (index, device) in input_devices.enumerate() {
        let name = device
            .name()
            .unwrap_or_else(|_| format!("Device {}", index));
        devices.push(AudioDevice {
            name,
            device_type: "input".to_string(),
            index,
        });
    }

    Ok(devices)
}

pub fn get_device_by_index(index: usize) -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    let input_devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate devices: {}", e))?;

    input_devices
        .into_iter()
        .nth(index)
        .ok_or_else(|| format!("Device index {} not found", index))
}
