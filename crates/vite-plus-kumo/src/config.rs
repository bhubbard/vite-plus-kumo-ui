use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warn,
    Off,
}

impl Default for Severity {
    fn default() -> Self {
        Severity::Warn
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KumoPluginOptions {
    #[serde(default = "default_severity_warn")]
    pub raw_controls: Severity,
    /// Hex colour literals only. Class-name colour rules are delegated to
    /// `eslint-plugin-better-tailwindcss`.
    #[serde(default = "default_severity_warn")]
    pub hardcoded_colors: Severity,
    #[serde(default = "default_severity_warn")]
    pub invalid_props: Severity,
    /// Severity for raw `<a>` anchors. When unset, inherits `raw_controls`.
    #[serde(default)]
    pub raw_links: Option<Severity>,
    /// Severity for the CSS entry-point directive rules.
    #[serde(default = "default_severity_error")]
    pub css_directives: Severity,
    #[serde(default = "default_true")]
    pub check_tailwind_v4: bool,
    #[serde(default = "default_ignore")]
    pub ignore_patterns: Vec<String>,
    #[serde(default)]
    pub css_path: Option<String>,
    #[serde(default)]
    pub styling_mode: Option<String>,
    #[serde(default)]
    pub css_mode: Option<String>,
    #[serde(default = "default_severity_error")]
    pub forbidden_imports: Severity,
    #[serde(default = "default_severity_warn")]
    pub check_fouc_script: Severity,
}

impl KumoPluginOptions {
    /// `rawLinks` falls back to `rawControls` so a single knob still turns both
    /// off, while allowing the two rules to be tuned independently.
    pub fn get_raw_links(&self) -> &Severity {
        self.raw_links.as_ref().unwrap_or(&self.raw_controls)
    }

    pub fn get_styling_mode(&self) -> &str {
        if let Some(mode) = &self.styling_mode {
            mode.as_str()
        } else if let Some(mode) = &self.css_mode {
            mode.as_str()
        } else {
            "tailwind"
        }
    }
}

fn default_severity_warn() -> Severity {
    Severity::Warn
}

fn default_severity_error() -> Severity {
    Severity::Error
}

fn default_true() -> bool {
    true
}

fn default_ignore() -> Vec<String> {
    vec![
        "node_modules".to_string(),
        "dist".to_string(),
        ".git".to_string(),
    ]
}

impl Default for KumoPluginOptions {
    fn default() -> Self {
        Self {
            raw_controls: default_severity_warn(),
            hardcoded_colors: default_severity_warn(),
            invalid_props: default_severity_warn(),
            raw_links: None,
            css_directives: default_severity_error(),
            check_tailwind_v4: true,
            ignore_patterns: default_ignore(),
            css_path: None,
            styling_mode: None,
            css_mode: None,
            forbidden_imports: default_severity_error(),
            check_fouc_script: default_severity_warn(),
        }
    }
}
