use std::path::Path;

/// 判断规范化后的 `source` 是否位于 `base` 目录之内（含 `base` 本身）。
///
/// 使用 `canonicalize` 解析符号链接与 `..`，防止 `~/../etc/passwd` 这类路径绕过白名单。
/// 任一侧无法规范化时返回 `false`（保守拒绝）。
pub fn path_is_within(source: &Path, base: &Path) -> bool {
    let Ok(source) = source.canonicalize() else {
        return false;
    };
    let Ok(base) = base.canonicalize() else {
        return false;
    };
    source.starts_with(&base)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tjg-path-guard-{tag}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn accepts_file_inside_base() {
        let base = temp_dir("accept");
        let inside = base.join("dropped.txt");
        std::fs::write(&inside, b"x").unwrap();

        assert!(path_is_within(&inside, &base));

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_file_outside_base() {
        let base = temp_dir("reject-base");
        let outside_base = temp_dir("reject-outside");
        let outside = outside_base.join("secret.txt");
        std::fs::write(&outside, b"x").unwrap();

        assert!(!path_is_within(&outside, &base));

        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&outside_base);
    }

    #[test]
    fn rejects_dotdot_traversal() {
        // `base/../<sibling>/secret.txt` 经 `..` 解析后位于 base 之外，必须被拒绝。
        let base = temp_dir("traversal-base");
        let sibling = temp_dir("traversal-sibling");
        let secret = sibling.join("secret.txt");
        std::fs::write(&secret, b"x").unwrap();

        let sibling_name = sibling.file_name().unwrap();
        let traversal = base.join("..").join(sibling_name).join("secret.txt");
        assert!(traversal.is_file());
        assert!(!path_is_within(&traversal, &base));

        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&sibling);
    }

    #[test]
    fn rejects_etc_passwd() {
        // 系统敏感路径（存在时）必须被拒绝，即使它确实是一个文件。
        let base = temp_dir("etc-base");
        let etc_passwd = Path::new("/etc/passwd");
        if etc_passwd.is_file() {
            assert!(!path_is_within(etc_passwd, &base));
        }

        let _ = std::fs::remove_dir_all(&base);
    }
}
