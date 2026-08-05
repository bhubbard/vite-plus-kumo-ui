mod config;
mod reporter;
mod rules;

use config::KumoPluginOptions;
use napi_derive::napi;
use reporter::format_terminal_report;
use rules::{analyze_file, KumoDiagnostic};

/// Version of the native engine ABI exposed to the JavaScript loader.
pub const KUMO_ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Increment when native rule behavior changes in a way that requires loader parity.
pub const KUMO_RULESET_VERSION: &str = "2";

/// N-API handshake used by the JavaScript loader before selecting this engine.
#[napi]
pub fn get_engine_version() -> String {
    KUMO_ENGINE_VERSION.to_string()
}

/// N-API handshake used to ensure native and JavaScript rule implementations agree.
#[napi]
pub fn get_ruleset_version() -> String {
    KUMO_RULESET_VERSION.to_string()
}

#[napi(object)]
pub struct LintResult {
    pub filename: String,
    pub diagnostics: Vec<KumoDiagnostic>,
    pub formatted_report: String,
    pub has_errors: bool,
}

#[napi]
pub fn lint_code(
    filename: String,
    code: String,
    options_json: Option<String>,
) -> napi::Result<LintResult> {
    let options: KumoPluginOptions = match options_json {
        Some(json_str) => serde_json::from_str(&json_str).map_err(|err| {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!(
                    "Invalid vite-plus-kumo options JSON: {err}. Expected a JSON object using severities 'error', 'warn', or 'off'."
                ),
            )
        })?,
        None => KumoPluginOptions::default(),
    };

    let diagnostics = analyze_file(&filename, &code, &options);
    let formatted_report = format_terminal_report(&filename, &diagnostics);
    let has_errors = diagnostics.iter().any(|d| d.severity == "error");

    Ok(LintResult {
        filename,
        diagnostics,
        formatted_report,
        has_errors,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_engine_handshake_versions() {
        assert_eq!(get_engine_version(), env!("CARGO_PKG_VERSION"));
        assert_eq!(get_ruleset_version(), KUMO_RULESET_VERSION);
        assert!(!KUMO_RULESET_VERSION.is_empty());
    }

    #[test]
    fn invalid_options_return_an_actionable_napi_error() {
        let err = match lint_code(
            "Component.tsx".to_string(),
            "<Button />".to_string(),
            Some(r#"{"rawControls":"warning"}"#.to_string()),
        ) {
            Ok(_) => panic!("invalid severity must not reset options to defaults"),
            Err(err) => err,
        };

        assert_eq!(err.status, napi::Status::InvalidArg);
        assert!(err.reason.contains("Invalid vite-plus-kumo options JSON"));
        assert!(err.reason.contains("error"));
        assert!(err.reason.contains("warn"));
        assert!(err.reason.contains("off"));
    }
}
