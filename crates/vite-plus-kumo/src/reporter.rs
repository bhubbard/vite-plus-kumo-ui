use crate::rules::KumoDiagnostic;

pub fn format_terminal_report(filename: &str, diagnostics: &[KumoDiagnostic]) -> String {
    if diagnostics.is_empty() {
        return String::new();
    }

    let mut output = String::new();
    output.push_str(&format!(
        "\n\x1b[36m[vite-plus-kumo]\x1b[0m Kumo UI violations in \x1b[1m{}\x1b[0m:\n",
        filename
    ));

    for d in diagnostics {
        let (sev_str, sev_color) = match d.severity.as_str() {
            "error" => ("ERROR", "\x1b[31m"),
            "warn" => ("WARN ", "\x1b[33m"),
            _ => ("INFO ", "\x1b[34m"),
        };

        output.push_str(&format!(
            "  {}:{}:{} - {}{}\x1b[0m \x1b[90m({})\x1b[0m\n",
            filename, d.line, d.column, sev_color, sev_str, d.rule_id
        ));
        output.push_str(&format!("    \x1b[1mMessage:\x1b[0m {}\n", d.message));
        output.push_str(&format!(
            "    \x1b[32m💡 Suggestion:\x1b[0m {}\n\n",
            d.suggestion
        ));
    }

    output
}
