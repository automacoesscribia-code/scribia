use serde::Serialize;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Serialize, Clone, Debug)]
pub struct UploadProgress {
    pub chunk_index: u32,
    pub total_chunks: u32,
    pub bytes_uploaded: u64,
    pub status: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct UploadResult {
    pub success: bool,
    pub chunks_uploaded: u32,
    pub total_bytes: u64,
    pub error: Option<String>,
}

pub struct UploadManager {
    supabase_url: String,
    supabase_key: String,
}

impl UploadManager {
    pub fn new(supabase_url: String, supabase_key: String) -> Self {
        Self {
            supabase_url,
            supabase_key,
        }
    }

    /// Upload a single chunk to Supabase Storage with retry
    pub async fn upload_chunk(
        &self,
        event_id: &str,
        lecture_id: &str,
        chunk_index: u32,
        file_path: &PathBuf,
    ) -> Result<u64, String> {
        let client = reqwest::Client::new();
        let storage_path = format!(
            "audio-files/{}/{}/chunk_{}.wav",
            event_id, lecture_id, chunk_index
        );
        let url = format!(
            "{}/storage/v1/object/{}",
            self.supabase_url, storage_path
        );

        let file_bytes = tokio::fs::read(file_path)
            .await
            .map_err(|e| format!("Failed to read chunk file: {}", e))?;

        let file_size = file_bytes.len() as u64;

        // Retry with exponential backoff (max 3 attempts)
        let mut attempt = 0;
        let max_attempts = 3;
        let mut last_error = String::new();

        while attempt < max_attempts {
            // Use POST with x-upsert header to handle both create and overwrite
            let result = client
                .post(&url)
                .header("Authorization", format!("Bearer {}", self.supabase_key))
                .header("Content-Type", "audio/wav")
                .header("x-upsert", "true")
                .body(file_bytes.clone())
                .send()
                .await;

            match result {
                Ok(response) if response.status().is_success() => {
                    return Ok(file_size);
                }
                Ok(response) => {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    last_error = format!("{} — {}", status, body);
                    eprintln!("Upload error: {}", last_error);
                }
                Err(e) => {
                    last_error = format!("Network error: {}", e);
                }
            }

            attempt += 1;
            if attempt < max_attempts {
                let delay = Duration::from_secs(2 * attempt as u64);
                eprintln!(
                    "Upload attempt {} failed, retrying in {:?}: {}",
                    attempt, delay, last_error
                );
                sleep(delay).await;
            }
        }

        Err(format!(
            "Upload failed after {} attempts: {}",
            max_attempts, last_error
        ))
    }

    /// Upload all chunks from a directory
    pub async fn upload_all_chunks(
        &self,
        event_id: &str,
        lecture_id: &str,
        output_dir: &str,
    ) -> Result<UploadResult, String> {
        let dir = PathBuf::from(output_dir);
        let mut entries: Vec<_> = std::fs::read_dir(&dir)
            .map_err(|e| format!("Failed to read output dir: {}", e))?
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map_or(false, |ext| ext == "wav")
            })
            .collect();

        entries.sort_by_key(|e| e.path());

        let total_chunks = entries.len() as u32;
        let mut total_bytes = 0u64;

        for (index, entry) in entries.iter().enumerate() {
            match self
                .upload_chunk(event_id, lecture_id, index as u32, &entry.path())
                .await
            {
                Ok(bytes) => {
                    total_bytes += bytes;
                    eprintln!(
                        "Uploaded chunk {}/{}: {} bytes",
                        index + 1, total_chunks, bytes
                    );
                }
                Err(e) => {
                    return Ok(UploadResult {
                        success: false,
                        chunks_uploaded: index as u32,
                        total_bytes,
                        error: Some(e),
                    });
                }
            }
        }

        Ok(UploadResult {
            success: true,
            chunks_uploaded: total_chunks,
            total_bytes,
            error: None,
        })
    }
}
