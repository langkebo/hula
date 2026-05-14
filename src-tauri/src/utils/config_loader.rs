use serde_json::Value;
use tracing::info;

/// Merge two JSON config objects recursively with homeserver family handling.
/// Reference: element-desktop's mergeVectorConfig pattern.
/// - `local` values override `base` values for the same keys
/// - Homeserver family config: if local uses old family (default_hs_url/default_is_url),
///   base's new family (default_server_name/default_server_config) is excluded
pub fn merge_config(mut base: Value, local: Value) -> Value {
    // Check if local config uses old homeserver family
    let local_has_old_hs_family = {
        let hs_url = local
            .get("default_hs_url")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let is_url = local
            .get("default_is_url")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        !hs_url.is_empty() || !is_url.is_empty()
    };

    // Check if local config uses new homeserver family
    let local_has_new_hs_family = {
        let server_name = local
            .get("default_server_name")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let server_config = local
            .get("default_server_config")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        !server_name.is_empty() || !server_config.is_empty()
    };

    // If local uses old family, remove new family from base
    if local_has_old_hs_family {
        if let Some(obj) = base.as_object_mut() {
            obj.remove("default_server_name");
            obj.remove("default_server_config");
            info!("Layered config: local uses old HS family, removing new HS family from base");
        }
    }

    // If local uses new family, remove old family from base
    if local_has_new_hs_family {
        if let Some(obj) = base.as_object_mut() {
            obj.remove("default_hs_url");
            obj.remove("default_is_url");
            info!("Layered config: local uses new HS family, removing old HS family from base");
        }
    }

    // Merge local overrides into base
    merge_json_values(&mut base, &local);
    base
}

fn merge_json_values(base: &mut Value, override_values: &Value) {
    match (base, override_values) {
        (Value::Object(base_map), Value::Object(override_map)) => {
            for (key, override_value) in override_map {
                match base_map.get_mut(key) {
                    Some(base_value) => {
                        // Recursively merge nested objects
                        merge_json_values(base_value, override_value);
                    }
                    None => {
                        // Key doesn't exist in base, insert it
                        base_map.insert(key.clone(), override_value.clone());
                    }
                }
            }
        }
        (base_value, override_value) => {
            // For non-object values, simply override
            *base_value = override_value.clone();
        }
    }
}

/// Load layered configuration:
/// 1. Load base config from resources/config.json (built-in at build time)
/// 2. Load local config from {app_data}/config.local.json (user overrides, optional)
/// 3. Merge them with homeserver family handling
pub fn load_layered_config(
    base_config_json: &str,
    local_config_json: Option<&str>,
) -> Result<Value, String> {
    let base: Value = serde_json::from_str(base_config_json)
        .map_err(|e| format!("Failed to parse base config: {}", e))?;

    let local: Value = match local_config_json {
        Some(content) if !content.trim().is_empty() => serde_json::from_str(content)
            .map_err(|e| format!("Failed to parse local config: {}", e))?,
        _ => {
            info!("Layered config: no local config found, using base config only");
            return Ok(base);
        }
    };

    let merged = merge_config(base, local);
    info!("Layered config: merged base + local config successfully");
    Ok(merged)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_merge_basic_override() {
        let base = json!({"server": "base.example.com", "port": 443});
        let local = json!({"server": "local.example.com"});
        let result = merge_config(base, local);
        assert_eq!(result["server"], "local.example.com");
        assert_eq!(result["port"], 443);
    }

    #[test]
    fn test_homeserver_old_family_excludes_new() {
        let base = json!({
            "default_hs_url": "https://base.example.com",
            "default_server_name": "base.example.com"
        });
        let local = json!({"default_hs_url": "https://custom.example.com"});
        let result = merge_config(base, local);
        assert_eq!(result["default_hs_url"], "https://custom.example.com");
        assert!(result.get("default_server_name").is_none());
    }

    #[test]
    fn test_homeserver_new_family_excludes_old() {
        let base = json!({
            "default_hs_url": "https://base.example.com",
            "default_server_name": "base.example.com"
        });
        let local = json!({"default_server_name": "custom.example.com"});
        let result = merge_config(base, local);
        assert_eq!(result["default_server_name"], "custom.example.com");
        assert!(result.get("default_hs_url").is_none());
    }

    #[test]
    fn test_load_layered_no_local() {
        let base = r#"{"server": "base.example.com"}"#;
        let result = load_layered_config(base, None).unwrap();
        assert_eq!(result["server"], "base.example.com");
    }

    #[test]
    fn test_load_layered_with_local() {
        let base = r#"{"server": "base.example.com", "port": 443}"#;
        let local = r#"{"server": "local.example.com"}"#;
        let result = load_layered_config(base, Some(local)).unwrap();
        assert_eq!(result["server"], "local.example.com");
        assert_eq!(result["port"], 443);
    }

    #[test]
    fn test_empty_local_config() {
        let base = r#"{"server": "base.example.com"}"#;
        let result = load_layered_config(base, Some("")).unwrap();
        assert_eq!(result["server"], "base.example.com");
    }

    #[test]
    fn test_invalid_local_json() {
        let base = r#"{"server": "base.example.com"}"#;
        let result = load_layered_config(base, Some("invalid json"));
        assert!(result.is_err());
    }
}
