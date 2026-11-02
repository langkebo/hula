use crate::common::path_guard::path_is_within;
use base64::{Engine as _, engine::general_purpose};
use pulldown_cmark::{CowStr, Event, Options, Parser, Tag, html};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// markdown 文件大小上限：避免一次性把超大文件读进内存并转成 HTML。
const MAX_MARKDOWN_BYTES: u64 = 8 * 1024 * 1024;
/// 内联图片大小上限：超过则保留原始 URL，避免把超大图片编码进 HTML。
const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;
/// 允许内联的图片扩展名。
const ALLOWED_IMAGE_EXTENSIONS: &[&str] =
    &["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];

/// markdown 允许读取的根目录（仅 `docs` 子树）。
///
/// 与 H-1 的收敛策略一致：不再对任意绝对路径直接 `PathBuf::from`，
/// 所有读取都必须落在应用已知的文档目录内。
fn allowed_markdown_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // 开发模式：项目根目录下的 docs
    if let Some(project_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        roots.push(project_root.join("docs"));
    }

    // 生产模式：应用资源目录下的 docs
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.join("docs"));
    }

    // 兼容旧版本安装路径
    if let Ok(app_config_dir) = app.path().app_config_dir() {
        roots.push(app_config_dir.join("docs"));
    }

    roots
}

/// 去掉 href 中可能存在的 `./` 与 `docs/` 前缀，便于与 `docs` 根目录拼接。
fn normalize_relative_path(path: &str) -> &str {
    let path = path.trim_start_matches("./");
    path.strip_prefix("docs/").unwrap_or(path)
}

fn is_markdown_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some("md") | Some("markdown")
    )
}

/// 解析并校验要读取的 markdown 路径。
///
/// 绝对路径必须落在允许的文档根目录内；相对路径依次在各文档根目录下尝试。
/// 拒绝远程 URL、非 markdown 扩展名与超大文件。
fn resolve_markdown_path(app: &AppHandle, file_path: &str) -> Result<PathBuf, String> {
    if file_path.starts_with("http://")
        || file_path.starts_with("https://")
        || file_path.starts_with("data:")
    {
        return Err(format!("拒绝从远程地址读取 markdown: {file_path}"));
    }

    let roots = allowed_markdown_roots(app);
    let relative = normalize_relative_path(file_path);
    let relative_path = PathBuf::from(relative);

    let candidates: Vec<PathBuf> = if relative_path.is_absolute() {
        vec![relative_path]
    } else {
        roots.iter().map(|root| root.join(&relative_path)).collect()
    };

    for candidate in candidates {
        if !candidate.is_file() {
            continue;
        }
        if !is_markdown_file(&candidate) {
            return Err(format!("拒绝读取非 markdown 文件: {file_path}"));
        }
        if !roots.iter().any(|root| path_is_within(&candidate, root)) {
            return Err(format!("拒绝读取文档目录之外的文件: {file_path}"));
        }
        let size = fs::metadata(&candidate)
            .map_err(|e| format!("无法读取文件元信息 {:?}: {}", candidate, e))?
            .len();
        if size > MAX_MARKDOWN_BYTES {
            return Err(format!(
                "markdown 文件过大（{} 字节，上限 {} 字节）: {file_path}",
                size, MAX_MARKDOWN_BYTES
            ));
        }
        return Ok(candidate);
    }

    Err(format!("无法找到文件: {file_path}"))
}

/// 处理图片 URL,将相对路径转换为 base64 数据 URI。
///
/// 安全：只内联 `base_dir` 之内、扩展名在白名单内、体积受限的图片；
/// 其余情况原样返回，避免被 `![](../../secret)` 之类的相对路径利用做本地文件读取。
fn process_image_url(url: &str, base_dir: &Path) -> String {
    // 如果是绝对 URL 或已经是 data URI,直接返回
    if url.starts_with("http://")
        || url.starts_with("https://")
        || url.starts_with("data:")
        || url.starts_with("asset://")
    {
        return url.to_string();
    }

    let img_path = if Path::new(url).is_absolute() {
        PathBuf::from(url)
    } else {
        base_dir.join(url)
    };

    if !img_path.is_file() {
        return url.to_string();
    }

    let Some(extension) = img_path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
    else {
        return url.to_string();
    };
    if !ALLOWED_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return url.to_string();
    }

    if !path_is_within(&img_path, base_dir) {
        return url.to_string();
    }

    let Ok(metadata) = fs::metadata(&img_path) else {
        return url.to_string();
    };
    if metadata.len() > MAX_IMAGE_BYTES {
        return url.to_string();
    }

    // 根据文件扩展名确定 MIME 类型
    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        _ => "image/png",
    };

    match fs::read(&img_path) {
        Ok(img_data) => {
            let base64_data = general_purpose::STANDARD.encode(&img_data);
            format!("data:{};base64,{}", mime_type, base64_data)
        }
        // 如果无法读取,返回原始 URL
        Err(_) => url.to_string(),
    }
}

/// 读取并解析 markdown 文件为 HTML
#[tauri::command]
pub async fn parse_markdown(app: AppHandle, file_path: String) -> Result<String, String> {
    let full_path = resolve_markdown_path(&app, &file_path)?;

    // 读取文件内容
    let markdown_content = fs::read_to_string(&full_path)
        .map_err(|e| format!("无法读取文件 {:?}: {}", full_path, e))?;

    // 配置 markdown 解析选项
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    // 解析 markdown
    let parser = Parser::new_ext(&markdown_content, options);

    // 获取 markdown 文件所在目录,用于解析相对路径
    let base_dir = full_path.parent().unwrap_or_else(|| Path::new("."));

    // 处理图片路径
    let events: Vec<Event> = parser
        .map(|event| {
            match event {
                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                }) => {
                    // 处理图片 URL
                    let new_url = process_image_url(&dest_url, base_dir);
                    Event::Start(Tag::Image {
                        link_type,
                        dest_url: CowStr::from(new_url),
                        title,
                        id,
                    })
                }
                _ => event,
            }
        })
        .collect();

    // 转换为 HTML
    let mut html_output = String::new();
    html::push_html(&mut html_output, events.into_iter());

    Ok(html_output)
}

/// 读取 README markdown 文件
#[tauri::command]
#[allow(unused_variables)]
pub async fn get_readme_html(app: AppHandle, language: String) -> Result<String, String> {
    // 构建 README 文件路径
    // 在开发模式下,从项目根目录读取 README.md
    // 在生产模式下,从资源目录的 docs 文件夹读取 README.md
    let readme_filename = if language == "zh" {
        "README.md"
    } else {
        "README.en.md"
    };

    let readme_relative_path = Path::new("docs").join(readme_filename);
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();

    let mut possible_paths = vec![];

    #[cfg(dev)]
    {
        // 开发环境：优先使用项目根目录的 README.md（本地图片）
        possible_paths.push(project_root.join(readme_filename));

        // 回退：src-tauri/docs 目录
        possible_paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(&readme_relative_path));
    }

    #[cfg(not(dev))]
    {
        // 生产环境：优先使用打包资源目录的 docs/README.md（远程图片）
        // 优先级 1: 应用资源目录
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        if let Ok(resource_dir) = app.path().resource_dir() {
            possible_paths.push(resource_dir.join(&readme_relative_path));
        }

        // 优先级 2: 应用配置目录
        if let Ok(app_config_dir) = app.path().app_config_dir() {
            possible_paths.push(app_config_dir.join(&readme_relative_path));
        }

        // 优先级 3: 回退到根目录
        possible_paths.push(project_root.join(readme_filename));
    }

    let mut markdown_content = None;
    let mut readme_path = None;
    for path in possible_paths {
        if let Ok(content) = fs::read_to_string(&path) {
            markdown_content = Some(content);
            readme_path = Some(path);
            break;
        }
    }

    let markdown_content =
        markdown_content.ok_or_else(|| format!("无法找到 {} 文件", readme_filename))?;

    let readme_path = readme_path.unwrap();

    // 配置 markdown 解析选项
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    // 解析 markdown
    let parser = Parser::new_ext(&markdown_content, options);

    // 获取 README 文件所在目录,用于解析相对路径
    let base_dir = readme_path.parent().unwrap_or_else(|| Path::new("."));

    // 处理图片路径
    let events: Vec<Event> = parser
        .map(|event| {
            match event {
                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                }) => {
                    // 处理图片 URL
                    let new_url = process_image_url(&dest_url, base_dir);
                    Event::Start(Tag::Image {
                        link_type,
                        dest_url: CowStr::from(new_url),
                        title,
                        id,
                    })
                }
                _ => event,
            }
        })
        .collect();

    // 转换为 HTML
    let mut html_output = String::new();
    html::push_html(&mut html_output, events.into_iter());

    Ok(html_output)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("tjg-markdown-cmd-{tag}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn normalize_relative_path_strips_doc_prefix() {
        assert_eq!(normalize_relative_path("./docs/a.md"), "a.md");
        assert_eq!(normalize_relative_path("docs/sub/a.md"), "sub/a.md");
        assert_eq!(normalize_relative_path("a.md"), "a.md");
    }

    #[test]
    fn is_markdown_file_accepts_only_markdown_extensions() {
        assert!(is_markdown_file(Path::new("a.md")));
        assert!(is_markdown_file(Path::new("a.MARKDOWN")));
        assert!(!is_markdown_file(Path::new("a.txt")));
        assert!(!is_markdown_file(Path::new("a")));
    }

    #[test]
    fn process_image_url_inlines_image_inside_base_dir() {
        let base = temp_dir("image-ok");
        let image = base.join("logo.png");
        std::fs::write(&image, b"\x89PNG").unwrap();

        let result = process_image_url("logo.png", &base);

        assert!(result.starts_with("data:image/png;base64,"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn process_image_url_rejects_traversal_outside_base_dir() {
        let base = temp_dir("image-traversal-base");
        let sibling = temp_dir("image-traversal-sibling");
        let secret = sibling.join("secret.png");
        std::fs::write(&secret, b"\x89PNG").unwrap();

        let sibling_name = sibling.file_name().unwrap().to_str().unwrap();
        let url = format!("../{sibling_name}/secret.png");
        assert_eq!(process_image_url(&url, &base), url);

        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&sibling);
    }

    #[test]
    fn process_image_url_keeps_non_image_files_as_is() {
        let base = temp_dir("image-non-image");
        let file = base.join("secret.txt");
        std::fs::write(&file, b"secret").unwrap();

        assert_eq!(process_image_url("secret.txt", &base), "secret.txt");

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn process_image_url_keeps_remote_urls_untouched() {
        for url in ["https://example.com/a.png", "data:image/png;base64,AAA"] {
            assert_eq!(process_image_url(url, Path::new("/nonexistent")), url);
        }
    }
}
