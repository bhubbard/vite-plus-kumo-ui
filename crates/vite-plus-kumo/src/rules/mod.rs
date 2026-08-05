use crate::config::{KumoPluginOptions, Severity};
use lazy_static::lazy_static;
use napi_derive::napi;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub mod generated_allowlists;
use generated_allowlists::*;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KumoDiagnostic {
    pub rule_id: String,
    pub line: u32,
    pub column: u32,
    pub message: String,
    pub suggestion: String,
    pub severity: String,
}

// ---------------------------------------------------------------------------
// Diagnostic text.
//
// These strings are duplicated verbatim in the JavaScript fallback engine
// (`packages/vite-plus-kumo/index.ts`). The parity harness
// (`scripts/kumo-parity-check.mjs`) asserts both engines emit byte-identical
// diagnostics, so any edit here must be mirrored there.
// ---------------------------------------------------------------------------
pub const MSG_RAW_BUTTON: &str = "Raw native `<button>` element detected.";
pub const SUG_RAW_BUTTON: &str = "Replace with `<Button>` from `@cloudflare/kumo`.";
pub const MSG_RAW_INPUT: &str = "Raw native `<input>` element detected.";
pub const SUG_RAW_INPUT: &str =
    "Replace with `<Input>` or `<Checkbox>`/`<Radio>` from `@cloudflare/kumo`.";
pub const MSG_RAW_SELECT: &str = "Raw native `<select>` element detected.";
pub const SUG_RAW_SELECT: &str = "Replace with `<Select>` or `<Combobox>` from `@cloudflare/kumo`.";
pub const MSG_RAW_TEXTAREA: &str = "Raw native `<textarea>` element detected.";
pub const SUG_RAW_TEXTAREA: &str = "Replace with `<Textarea>` from `@cloudflare/kumo`.";
pub const MSG_RAW_ANCHOR: &str = "Raw native `<a>` element detected in JSX.";
pub const SUG_RAW_ANCHOR: &str =
    "Use `<Link>` from `@cloudflare/kumo` to ensure consistent theme styling and accessibility.";
pub const SUG_HEX_COLOR: &str =
    "Use Kumo semantic color tokens like `bg-kumo-base`, `text-kumo-default`, or `bg-kumo-brand`.";
pub const MSG_FORBIDDEN_IMPORT: &str =
    "Forbidden direct import of scaffolded Kumo UI block from `@cloudflare/kumo`.";
pub const SUG_FORBIDDEN_IMPORT: &str = "CLI scaffolded blocks (e.g. PageHeader, ResourceList, DeleteResource) must be copied into your project's source directory (e.g. via `npx @cloudflare/kumo add <block>`), not imported directly from `@cloudflare/kumo`.";
pub const MSG_FOUC: &str = "No theme initialization script detected in index.html <head>.";
pub const SUG_FOUC: &str = "Add an inline script in <head> to read saved theme (e.g. setting `data-mode` on <html>) before initial render to prevent Flash of Unstyled Content (FOUC).";
pub const MSG_CSS_IMPORT: &str = "Missing required Kumo CSS stylesheet import in CSS entry point.";
pub const SUG_CSS_IMPORT: &str = "Add `@import \"@cloudflare/kumo/styles/css\";` or `@import \"@cloudflare/kumo/styles/theme-kumo.css\";` to your CSS file.";
pub const MSG_TAILWIND_V4: &str = "Missing required Kumo Tailwind v4 directives in CSS file.";
pub const SUG_TAILWIND_V4: &str = "Add `@source \"../node_modules/@cloudflare/kumo/dist/**/*\";` and `@import \"@cloudflare/kumo/styles/tailwind\";` to your CSS entry point.";

lazy_static! {
    // Detect direct block imports across line breaks. The source is comment-masked
    // before matching, so commented examples cannot satisfy this rule.
    static ref FORBIDDEN_BLOCK_IMPORT_REGEX: Regex = Regex::new(r#"(?s)\bimport\s+(?:type\s+)?\{[^}]*\b(?:PageHeader|ResourceList|DeleteResource|LayerCard|CommandPalette|TableOfContents)\b[^}]*\}\s*from\s*['"]@cloudflare/kumo['"]"#).unwrap();

    // Hex colors: exactly 3, 4, 6 or 8 digits. Longest alternative first so
    // `#abcdefa` (7 digits) is not mis-read as a 6-digit color.
    //
    // This is the only colour rule left here. Everything that reasons about
    // *class names* — raw Tailwind palette colours, `bg-white`/`text-black`,
    // `dark:` variants, legacy `cf-*`, and unknown `*-kumo-*` tokens — is
    // delegated to `eslint-plugin-better-tailwindcss`, which resolves the real
    // Tailwind config instead of pattern-matching source text.
    static ref HEX_COLOR_REGEX: Regex = Regex::new(r#"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b"#).unwrap();

    // Static JSX prop values may be direct strings or expression-wrapped string
    // literals. Dynamic expressions are intentionally ignored.
    static ref ATTR_REGEX: Regex = Regex::new(
        r#"\b([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)\s*\})"#
    ).unwrap();
    static ref NAMED_IMPORT_REGEX: Regex = Regex::new(
        r#"(?s)\bimport\s+\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]"#
    ).unwrap();
    static ref NAMESPACE_IMPORT_REGEX: Regex = Regex::new(
        r#"\bimport\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+)['"]"#
    ).unwrap();
    static ref DEFAULT_IMPORT_REGEX: Regex = Regex::new(
        r#"\bimport\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:,|\s+from\s+['"])"#
    ).unwrap();
    static ref LOCAL_COMPONENT_BINDING_REGEX: Regex = Regex::new(
        r#"\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_$]*)\b"#
    ).unwrap();

    static ref CSS_KUMO_IMPORT_REGEX: Regex = Regex::new(
        r#"(?im)^[ \t]*@import\s+(?:url\(\s*)?["']@cloudflare/kumo/styles(?:/css|/theme-kumo(?:\.css)?)?["']\s*\)?"#
    ).unwrap();
    static ref CSS_KUMO_TAILWIND_IMPORT_REGEX: Regex = Regex::new(
        r#"(?im)^[ \t]*@import\s+(?:url\(\s*)?["']@cloudflare/kumo/styles/tailwind["']\s*\)?"#
    ).unwrap();
    static ref CSS_KUMO_SOURCE_REGEX: Regex = Regex::new(
        r#"(?im)^[ \t]*@source\s+["'][^"']*(?:node_modules/)?@cloudflare/kumo/dist/(?:\*\*/\*|[^"']+)["']"#
    ).unwrap();
    static ref HTML_COMMENT_REGEX: Regex = Regex::new(r"(?is)<!--.*?-->").unwrap();
    static ref HEAD_REGEX: Regex = Regex::new(r"(?is)<head\b[^>]*>(.*?)</head\s*>").unwrap();
    static ref SCRIPT_REGEX: Regex = Regex::new(r"(?is)<script\b[^>]*>(.*?)</script\s*>").unwrap();
    static ref DATA_MODE_MUTATION_REGEX: Regex = Regex::new(
        r#"(?is)(?:setAttribute\s*\(\s*['"]data-mode['"]\s*,|\.dataset\s*\.\s*mode\s*=)"#
    ).unwrap();
}

/// Column number (1-based) in **Unicode scalar values**, not bytes.
///
/// The JavaScript engine reports the same unit, so a `•` earlier in the line
/// cannot shift the two engines apart.
fn col_at(haystack: &str, byte_offset: usize) -> u32 {
    haystack[..byte_offset].chars().count() as u32 + 1
}

fn position_at(content: &str, byte_offset: usize) -> (u32, u32) {
    let before = &content[..byte_offset];
    let line = before.bytes().filter(|byte| *byte == b'\n').count() as u32 + 1;
    let line_start = before.rfind('\n').map_or(0, |index| index + 1);
    (
        line,
        col_at(&content[line_start..], byte_offset - line_start),
    )
}

pub fn analyze_file(
    filename: &str,
    content: &str,
    options: &KumoPluginOptions,
) -> Vec<KumoDiagnostic> {
    let mut diagnostics = Vec::new();

    let norm_file = filename.replace('\\', "/");
    for pattern in &options.ignore_patterns {
        let pat = pattern.trim_matches('/');
        if pat.is_empty() {
            continue;
        }
        let matched = norm_file.split('/').any(|seg| seg == pat)
            || (pattern.contains('/') && norm_file.contains(pat));
        if matched {
            return diagnostics;
        }
    }

    // JSX rules apply to JSX files only. Running them over `.ts`/`.js` flagged
    // markup held in ordinary string literals — at error severity, which failed
    // the build.
    let is_jsx = filename.ends_with(".tsx") || filename.ends_with(".jsx");
    let is_css = filename.ends_with(".css") || filename.ends_with(".scss");
    let is_html = filename.ends_with(".html");

    if is_jsx {
        analyze_jsx_file(content, options, &mut diagnostics);
    } else if is_css {
        analyze_css_file(content, options, &mut diagnostics);
    } else if is_html {
        analyze_html_file(content, options, &mut diagnostics);
    }

    diagnostics
}

fn severity_to_str(sev: &Severity) -> String {
    match sev {
        Severity::Error => "error".to_string(),
        Severity::Warn => "warn".to_string(),
        Severity::Off => "off".to_string(),
    }
}

/// Lexer state that must survive across line boundaries.
#[derive(Default)]
struct MaskState {
    /// Inside an unterminated `/* … */`.
    in_block: bool,
    /// One entry per open template literal; the value is how many `${` blocks
    /// are currently open inside it. `Some(0)` means "in template text".
    ///
    /// Tracking this across lines is what stops a `/*` or `//` sitting in the
    /// body of a multi-line template literal from opening a comment — which
    /// previously blanked the rest of the file.
    templates: Vec<u32>,
}

/// Blank out comment content, replacing every commented character with a space.
///
/// One character in, one character out, so line and column numbers — and the
/// offsets every rule reports — are unchanged. Single and double quote state
/// resets per line (those literals cannot span lines); block-comment and
/// template-literal state carry across lines via `state`.
fn mask_comments_line(line: &str, state: &mut MaskState) -> String {
    let chars: Vec<char> = line.chars().collect();
    let n = chars.len();
    let mut out = String::with_capacity(line.len());

    let mut i = 0;
    let mut in_single = false;
    let mut in_double = false;
    let mut in_regex = false;
    let mut regex_char_class = false;
    let mut prev_code: Option<char> = None;

    while i < n {
        let c = chars[i];

        if state.in_block {
            if c == '*' && i + 1 < n && chars[i + 1] == '/' {
                out.push(' ');
                out.push(' ');
                i += 2;
                state.in_block = false;
            } else {
                out.push(' ');
                i += 1;
            }
            continue;
        }

        // Template literal *text* — everything here is data, not code, so no
        // comment may start. Only the closing backtick and `${` matter.
        if !in_single && !in_double && matches!(state.templates.last(), Some(0)) {
            if c == '\\' && i + 1 < n {
                out.push(c);
                out.push(chars[i + 1]);
                i += 2;
            } else if c == '`' {
                state.templates.pop();
                out.push(c);
                i += 1;
            } else if c == '$' && i + 1 < n && chars[i + 1] == '{' {
                if let Some(top) = state.templates.last_mut() {
                    *top += 1;
                }
                out.push('$');
                out.push('{');
                i += 2;
            } else {
                out.push(c);
                i += 1;
            }
            continue;
        }

        // A regex body is code, but comment-looking text inside it is inert
        // (notably `/[/*]/`). Preserve it while finding its unescaped terminator.
        if in_regex {
            if c == '\\' && i + 1 < n {
                out.push(c);
                out.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == '[' {
                regex_char_class = true;
            } else if c == ']' {
                regex_char_class = false;
            } else if c == '/' && !regex_char_class {
                in_regex = false;
            }
            out.push(c);
            i += 1;
            continue;
        }

        // Code context: top level, or inside a `${ … }` expression.
        if !in_single && !in_double && c == '/' && i + 1 < n {
            if chars[i + 1] == '/' {
                for _ in i..n {
                    out.push(' ');
                }
                break;
            }
            if chars[i + 1] == '*' {
                out.push(' ');
                out.push(' ');
                i += 2;
                state.in_block = true;
                continue;
            }

            // Conservative expression-prefix heuristic. It avoids treating
            // division as regex while covering common declarations/calls.
            if prev_code.map_or(true, |p| {
                matches!(
                    p,
                    '=' | '(' | '[' | '{' | ',' | ':' | ';' | '!' | '?' | '&' | '|'
                )
            }) {
                in_regex = true;
                regex_char_class = false;
                out.push(c);
                i += 1;
                continue;
            }
        }

        if (in_single || in_double) && c == '\\' && i + 1 < n {
            out.push(c);
            out.push(chars[i + 1]);
            i += 2;
            continue;
        }

        if c == '\'' && !in_double {
            in_single = !in_single;
        } else if c == '"' && !in_single {
            in_double = !in_double;
        } else if c == '`' && !in_single && !in_double {
            state.templates.push(0);
        } else if !in_single && !in_double {
            // Track `${ … }` nesting so the closing brace returns us to
            // template text rather than leaving us in code context forever.
            if let Some(top) = state.templates.last_mut() {
                if *top > 0 {
                    if c == '{' {
                        *top += 1;
                    } else if c == '}' {
                        *top -= 1;
                    }
                }
            }
        }

        if !c.is_whitespace() {
            prev_code = Some(c);
        }
        out.push(c);
        i += 1;
    }

    out
}

/// Mask every comment in `content`, preserving line and column structure.
pub fn mask_comments(content: &str) -> String {
    let mut state = MaskState::default();
    let masked: Vec<String> = content
        .lines()
        .map(|l| mask_comments_line(l, &mut state))
        .collect();
    masked.join("\n")
}

#[derive(Default)]
struct KumoBindings {
    /// Local JSX identifier -> canonical Kumo export name.
    named: HashMap<String, String>,
    /// Local identifiers introduced by `import * as Name from '@cloudflare/kumo'`.
    namespaces: HashSet<String>,
    /// Value bindings that suppress legacy validation of an unbound canonical tag.
    locals: HashSet<String>,
}

impl KumoBindings {
    fn resolve<'a>(&'a self, tag_name: &'a str) -> Option<&'a str> {
        if let Some(canonical) = self.named.get(tag_name) {
            return Some(canonical.as_str());
        }

        if let Some((namespace, canonical)) = tag_name.split_once('.') {
            if self.namespaces.contains(namespace) && !canonical.contains('.') {
                return Some(canonical);
            }
            return None;
        }

        // Preserve historical snippet behavior for canonical-looking unbound
        // tags, but never apply it when the file declares/imports that value.
        if tag_name.starts_with(|c: char| c.is_ascii_uppercase()) && !self.locals.contains(tag_name)
        {
            return Some(tag_name);
        }

        None
    }
}

fn collect_kumo_bindings(content: &str) -> KumoBindings {
    let mut bindings = KumoBindings::default();

    for captures in LOCAL_COMPONENT_BINDING_REGEX.captures_iter(content) {
        if let Some(local) = captures.get(1) {
            bindings.locals.insert(local.as_str().to_string());
        }
    }

    for captures in DEFAULT_IMPORT_REGEX.captures_iter(content) {
        if let Some(local) = captures.get(1) {
            bindings.locals.insert(local.as_str().to_string());
        }
    }

    for captures in NAMESPACE_IMPORT_REGEX.captures_iter(content) {
        let (Some(local), Some(source)) = (captures.get(1), captures.get(2)) else {
            continue;
        };
        bindings.locals.insert(local.as_str().to_string());
        if source.as_str() == "@cloudflare/kumo" {
            bindings.namespaces.insert(local.as_str().to_string());
        }
    }

    for captures in NAMED_IMPORT_REGEX.captures_iter(content) {
        let (Some(specifiers), Some(source)) = (captures.get(1), captures.get(2)) else {
            continue;
        };
        for specifier in specifiers.as_str().split(',') {
            let mut parts = specifier.split_whitespace();
            let Some(imported) = parts.next() else {
                continue;
            };
            // Type-only specifiers do not introduce a JSX value binding.
            if imported == "type" {
                continue;
            }
            let local = match (parts.next(), parts.next()) {
                (Some("as"), Some(alias)) => alias,
                _ => imported,
            };
            bindings.locals.insert(local.to_string());
            if source.as_str() == "@cloudflare/kumo" {
                bindings
                    .named
                    .insert(local.to_string(), imported.to_string());
            }
        }
    }

    bindings
}

fn analyze_jsx_file(
    content: &str,
    options: &KumoPluginOptions,
    diagnostics: &mut Vec<KumoDiagnostic>,
) {
    // Every rule runs against comment-masked source, so neither the line-based
    // rules nor the multi-line tag scanner can fire inside a comment.
    let masked = mask_comments(content);

    // 0. Forbidden Direct Block Imports (including multiline named imports).
    if options.forbidden_imports != Severity::Off {
        for mat in FORBIDDEN_BLOCK_IMPORT_REGEX.find_iter(&masked) {
            let (line, column) = position_at(&masked, mat.start());
            diagnostics.push(KumoDiagnostic {
                rule_id: "kumo/no-forbidden-imports".to_string(),
                line,
                column,
                message: MSG_FORBIDDEN_IMPORT.to_string(),
                suggestion: SUG_FORBIDDEN_IMPORT.to_string(),
                severity: severity_to_str(&options.forbidden_imports),
            });
        }
    }

    let tags = find_jsx_tags(&masked);
    let bindings = collect_kumo_bindings(&masked);

    // 1. Raw controls and links. Scanning parsed tag-shaped regions rather than
    // source text avoids reporting markup embedded in JS strings/templates.
    for tag in &tags {
        let raw_control = match tag.comp_name {
            "button" => Some((MSG_RAW_BUTTON, SUG_RAW_BUTTON)),
            "input" => Some((MSG_RAW_INPUT, SUG_RAW_INPUT)),
            "select" => Some((MSG_RAW_SELECT, SUG_RAW_SELECT)),
            "textarea" => Some((MSG_RAW_TEXTAREA, SUG_RAW_TEXTAREA)),
            _ => None,
        };
        if options.raw_controls != Severity::Off {
            if let Some((message, suggestion)) = raw_control {
                diagnostics.push(KumoDiagnostic {
                    rule_id: "kumo/no-raw-controls".to_string(),
                    line: tag.line,
                    column: tag.column,
                    message: message.to_string(),
                    suggestion: suggestion.to_string(),
                    severity: severity_to_str(&options.raw_controls),
                });
            }
        }
        if tag.comp_name == "a" && *options.get_raw_links() != Severity::Off {
            diagnostics.push(KumoDiagnostic {
                rule_id: "kumo/no-raw-links".to_string(),
                line: tag.line,
                column: tag.column,
                message: MSG_RAW_ANCHOR.to_string(),
                suggestion: SUG_RAW_ANCHOR.to_string(),
                severity: severity_to_str(options.get_raw_links()),
            });
        }
    }

    for (line_idx, line) in masked.lines().enumerate() {
        let line_num = (line_idx + 1) as u32;

        // 2. Hardcoded hex colors.
        //
        // Class-name colour rules live in `better-tailwindcss`; a hex literal
        // in a `style` prop or a constant is not a class, so it stays here.
        if options.hardcoded_colors != Severity::Off {
            for mat in HEX_COLOR_REGEX.find_iter(line) {
                diagnostics.push(KumoDiagnostic {
                    rule_id: "kumo/no-hardcoded-colors".to_string(),
                    line: line_num,
                    column: col_at(line, mat.start()),
                    message: format!("Hardcoded hex color '{}' detected.", mat.as_str()),
                    suggestion: SUG_HEX_COLOR.to_string(),
                    severity: severity_to_str(&options.hardcoded_colors),
                });
            }
        }
    }

    // 6. Component Prop Validation (multiline & expression aware)
    if options.invalid_props != Severity::Off {
        for tag_match in tags {
            let Some(canonical_name) = bindings.resolve(tag_match.comp_name) else {
                continue;
            };
            for attr_caps in ATTR_REGEX.captures_iter(tag_match.attrs) {
                let prop_name = attr_caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let prop_val = (2..=6)
                    .find_map(|group| attr_caps.get(group).map(|m| m.as_str()))
                    .unwrap_or("");

                if let Some(valid_values) = get_valid_prop_values(canonical_name, prop_name) {
                    if !valid_values.contains(prop_val) {
                        let mut sorted_valid: Vec<&&str> = valid_values.iter().collect();
                        sorted_valid.sort();
                        let formatted_valid = sorted_valid
                            .iter()
                            .map(|s| format!("'{}'", s))
                            .collect::<Vec<_>>()
                            .join(", ");

                        diagnostics.push(KumoDiagnostic {
                            rule_id: "kumo/validate-kumo-props".to_string(),
                            line: tag_match.line,
                            column: tag_match.column,
                            message: format!(
                                "Invalid {} '{}' passed to <{}>.",
                                prop_name, prop_val, tag_match.comp_name
                            ),
                            suggestion: format!(
                                "Valid {} values for <{}> are: {}.",
                                prop_name, tag_match.comp_name, formatted_valid
                            ),
                            severity: severity_to_str(&options.invalid_props),
                        });
                    }
                }
            }
        }
    }
}

struct JsxTagMatch<'a> {
    comp_name: &'a str,
    attrs: &'a str,
    line: u32,
    column: u32,
}

/// Upper bound on how far the scanner will look for a tag's closing `>`.
///
/// Real JSX tags are far shorter than this. The bound matters because a `<`
/// followed by an uppercase letter that never closes — a generic, a comparison,
/// a fragment inside a string — makes the scanner rewind and re-enter the same
/// region, which is quadratic without a cap.
const MAX_TAG_SCAN_CHARS: usize = 4096;

fn find_jsx_tags(content: &str) -> Vec<JsxTagMatch<'_>> {
    let mut results = Vec::new();
    let chars: Vec<(usize, char)> = content.char_indices().collect();
    let n = chars.len();
    let byte_len = content.len();
    let byte_at = |k: usize| if k < n { chars[k].0 } else { byte_len };

    let mut line_num: u32 = 1;
    let mut col_num: u32 = 1;

    let mut k = 0;
    while k < n {
        let c = chars[k].1;

        if c == '\n' {
            line_num += 1;
            col_num = 1;
            k += 1;
            continue;
        }

        // Skip over string and template literals in code position, so markup
        // held in a string — `const s = "<Badge variant='x'>"` — is not
        // mistaken for real JSX.
        let apostrophe_in_text = c == '\''
            && k > 0
            && k + 1 < n
            && chars[k - 1].1.is_alphanumeric()
            && chars[k + 1].1.is_alphanumeric();
        if c == '"' || c == '`' || (c == '\'' && !apostrophe_in_text) {
            let quote = c;
            let mut j = k + 1;
            col_num += 1;
            while j < n {
                let jc = chars[j].1;
                if jc == '\\' && j + 1 < n {
                    if chars[j + 1].1 == '\n' {
                        line_num += 1;
                        col_num = 1;
                    } else {
                        col_num += 2;
                    }
                    j += 2;
                    continue;
                }
                if jc == '\n' {
                    line_num += 1;
                    col_num = 1;
                    j += 1;
                    // A single- or double-quoted literal cannot span lines;
                    // treat the newline as the end of it.
                    if quote != '`' {
                        break;
                    }
                    continue;
                }
                col_num += 1;
                j += 1;
                if jc == quote {
                    break;
                }
            }
            k = j;
            continue;
        }

        if c == '<' && k + 1 < n && chars[k + 1].1.is_ascii_alphabetic() {
            let start_line = line_num;
            let start_col = col_num;

            let name_start = k + 1;
            let mut name_end = name_start;
            while name_end < n {
                let nc = chars[name_end].1;
                if nc.is_ascii_alphanumeric() || nc == '.' || nc == '_' || nc == '-' {
                    name_end += 1;
                } else {
                    break;
                }
            }

            if name_end > name_start {
                // The inner scan advances the counters as it walks. If it never
                // finds a closing `>` it must not leave them at EOF, or every
                // later diagnostic reports a line that does not exist.
                let saved_line = line_num;
                let saved_col = col_num;

                let mut j = name_end;
                // The outer cursor has not walked `<ComponentName`; account for
                // it before scanning attributes so a later same-line tag gets an
                // exact column rather than one shortened by the prior name.
                col_num += (name_end - k) as u32;
                let mut brace_depth = 0;
                let mut in_single = false;
                let mut in_double = false;
                let mut in_backtick = false;
                let mut tag_end = None;
                let scan_limit = n.min(name_end.saturating_add(MAX_TAG_SCAN_CHARS));

                while j < scan_limit {
                    let jc = chars[j].1;
                    if jc == '\'' && !in_double && !in_backtick {
                        in_single = !in_single;
                    } else if jc == '"' && !in_single && !in_backtick {
                        in_double = !in_double;
                    } else if jc == '`' && !in_single && !in_double {
                        in_backtick = !in_backtick;
                    } else if !in_single && !in_double && !in_backtick {
                        if jc == '{' {
                            brace_depth += 1;
                        } else if jc == '}' {
                            if brace_depth > 0 {
                                brace_depth -= 1;
                            }
                        } else if brace_depth == 0 && jc == '>' {
                            tag_end = Some(j);
                            break;
                        }
                    }

                    if jc == '\n' {
                        line_num += 1;
                        col_num = 1;
                    } else {
                        col_num += 1;
                    }

                    j += 1;
                }

                if let Some(end_k) = tag_end {
                    results.push(JsxTagMatch {
                        comp_name: &content[byte_at(name_start)..byte_at(name_end)],
                        attrs: &content[byte_at(name_end)..byte_at(end_k)],
                        line: start_line,
                        column: start_col,
                    });
                    k = end_k + 1;
                    col_num += 1;
                    continue;
                }

                // Unterminated tag: rewind the counters and treat `<` as text.
                line_num = saved_line;
                col_num = saved_col;
            }
        }

        col_num += 1;
        k += 1;
    }

    results
}

pub fn analyze_html_file(
    content: &str,
    options: &KumoPluginOptions,
    diagnostics: &mut Vec<KumoDiagnostic>,
) {
    if options.check_fouc_script == Severity::Off {
        return;
    }

    // The theme must be applied by executable script in <head>. HTML comments,
    // body text, attributes, and unrelated localStorage calls do not count.
    let uncommented = HTML_COMMENT_REGEX.replace_all(content, "");
    let head = HEAD_REGEX
        .captures(&uncommented)
        .and_then(|captures| captures.get(1))
        .map_or("", |matched| matched.as_str());
    let has_fouc_script = SCRIPT_REGEX.captures_iter(head).any(|captures| {
        captures
            .get(1)
            .map(|body| DATA_MODE_MUTATION_REGEX.is_match(&mask_comments(body.as_str())))
            .unwrap_or(false)
    });

    if !has_fouc_script {
        diagnostics.push(KumoDiagnostic {
            rule_id: "kumo/check-fouc-script".to_string(),
            line: 1,
            column: 1,
            message: MSG_FOUC.to_string(),
            suggestion: SUG_FOUC.to_string(),
            severity: severity_to_str(&options.check_fouc_script),
        });
    }
}

fn analyze_css_file(
    content: &str,
    options: &KumoPluginOptions,
    diagnostics: &mut Vec<KumoDiagnostic>,
) {
    let masked = mask_comments(content);

    if options.hardcoded_colors != Severity::Off {
        for mat in HEX_COLOR_REGEX.find_iter(&masked) {
            let (line, column) = position_at(&masked, mat.start());
            diagnostics.push(KumoDiagnostic {
                rule_id: "kumo/no-hardcoded-colors".to_string(),
                line,
                column,
                message: format!("Hardcoded hex color '{}' detected.", mat.as_str()),
                suggestion: SUG_HEX_COLOR.to_string(),
                severity: severity_to_str(&options.hardcoded_colors),
            });
        }
    }

    let mode = options.get_styling_mode();
    if mode == "none" || options.css_directives == Severity::Off {
        return;
    }

    if mode == "vanilla" || mode == "css" {
        if !CSS_KUMO_IMPORT_REGEX.is_match(&masked) {
            diagnostics.push(KumoDiagnostic {
                rule_id: "kumo/check-kumo-css-import".to_string(),
                line: 1,
                column: 1,
                message: MSG_CSS_IMPORT.to_string(),
                suggestion: SUG_CSS_IMPORT.to_string(),
                severity: severity_to_str(&options.css_directives),
            });
        }
        return;
    }

    if !options.check_tailwind_v4 {
        return;
    }

    let has_source = CSS_KUMO_SOURCE_REGEX.is_match(&masked);
    let has_import = CSS_KUMO_TAILWIND_IMPORT_REGEX.is_match(&masked);

    if !has_source || !has_import {
        diagnostics.push(KumoDiagnostic {
            rule_id: "kumo/check-tailwind-v4-kumo-source".to_string(),
            line: 1,
            column: 1,
            message: MSG_TAILWIND_V4.to_string(),
            suggestion: SUG_TAILWIND_V4.to_string(),
            severity: severity_to_str(&options.css_directives),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts() -> KumoPluginOptions {
        KumoPluginOptions::default()
    }

    fn count(diags: &[KumoDiagnostic], rule: &str) -> usize {
        diags.iter().filter(|d| d.rule_id == rule).count()
    }

    #[test]
    fn test_detect_raw_button() {
        let code = r#"
            export function MyComp() {
                return <button className="btn">Click me</button>;
            }
        "#;
        let diagnostics = analyze_file("MyComp.tsx", code, &opts());
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].rule_id, "kumo/no-raw-controls");
    }

    #[test]
    fn test_detect_raw_color() {
        let code = r##"
            export function MyComp() {
                return <div style={{ color: "#ff0000" }}>Hello</div>;
            }
        "##;
        let diagnostics = analyze_file("MyComp.tsx", code, &opts());
        assert!(diagnostics
            .iter()
            .any(|d| d.rule_id == "kumo/no-hardcoded-colors"));
    }

    #[test]
    fn test_detect_invalid_button_prop() {
        let code = r#"
            import { Button } from '@cloudflare/kumo';
            export function MyComp() {
                return <Button variant="super-cool">Action</Button>;
            }
        "#;
        let diagnostics = analyze_file("MyComp.tsx", code, &opts());
        assert!(diagnostics
            .iter()
            .any(|d| d.rule_id == "kumo/validate-kumo-props"));
    }

    #[test]
    fn test_local_button_is_not_validated_as_kumo() {
        let code = r#"
            function Button(props) { return <div>{props.children}</div>; }
            export function Example() {
                return <Button variant="not-a-kumo-variant">Local</Button>;
            }
        "#;
        assert_eq!(
            count(
                &analyze_file("LocalButton.tsx", code, &opts()),
                "kumo/validate-kumo-props"
            ),
            0
        );
    }

    #[test]
    fn test_aliased_kumo_button_uses_canonical_prop_allowlist() {
        let code = r#"
            import { Button as KumoButton } from '@cloudflare/kumo';
            export const Example = () => <KumoButton variant="not-valid">Action</KumoButton>;
        "#;
        let diagnostics = analyze_file("AliasedButton.tsx", code, &opts());
        let hit = diagnostics
            .iter()
            .find(|d| d.rule_id == "kumo/validate-kumo-props")
            .expect("aliased Kumo Button should be validated");
        assert!(hit.message.contains("<KumoButton>"));
    }

    #[test]
    fn test_namespace_kumo_button_uses_canonical_prop_allowlist() {
        let code = r#"
            import * as Kumo from '@cloudflare/kumo';
            export const Example = () => <Kumo.Button variant="not-valid">Action</Kumo.Button>;
        "#;
        let diagnostics = analyze_file("NamespaceButton.tsx", code, &opts());
        let hit = diagnostics
            .iter()
            .find(|d| d.rule_id == "kumo/validate-kumo-props")
            .expect("namespace Kumo Button should be validated");
        assert!(hit.message.contains("<Kumo.Button>"));
    }

    #[test]
    fn test_ignore_comments() {
        let code = r##"
            // return <button>Click</button>;
            /* const color = "#ff0000"; */
            export function MyComp() {
                return <div>Hello</div>;
            }
        "##;
        let diagnostics = analyze_file("MyComp.tsx", code, &opts());
        assert_eq!(diagnostics.len(), 0);
    }

    /// M-3: a multi-line block comment must be masked in full, not just the
    /// lines whose first character happens to be `*` or `/`.
    #[test]
    fn test_ignore_multiline_block_comment_body() {
        let code = "/*\nconst c = \"#ff0000\";\n*/\nexport const ok = 1;";
        let diagnostics = analyze_file("Comment.tsx", code, &opts());
        assert_eq!(diagnostics.len(), 0, "found: {:?}", diagnostics);
    }

    /// M-1: the multi-line tag scanner must not validate props inside comments.
    #[test]
    fn test_ignore_props_inside_comments() {
        for code in [
            "// <Badge variant=\"bogus\">x</Badge>",
            "/*\n<Badge variant=\"bogus\">x</Badge>\n*/",
            "const y = 1; // <Badge variant=\"bogus\">",
        ] {
            let diagnostics = analyze_file("C.tsx", code, &opts());
            assert_eq!(
                count(&diagnostics, "kumo/validate-kumo-props"),
                0,
                "code: {}",
                code
            );
        }
    }

    /// H-3: an unterminated `<Uppercase` must not shift later line numbers.
    #[test]
    fn test_unterminated_tag_does_not_corrupt_line_numbers() {
        let code = "const s = \"<Foo\";\n<Badge variant=\"bogus\">a</Badge>\n<Badge variant=\"nope\">b</Badge>";
        let diagnostics = analyze_file("C.tsx", code, &opts());
        let props: Vec<_> = diagnostics
            .iter()
            .filter(|d| d.rule_id == "kumo/validate-kumo-props")
            .collect();
        assert_eq!(props.len(), 2);
        assert_eq!(props[0].line, 2);
        assert_eq!(props[1].line, 3);

        let code2 = "const t = `<Bar`;\n\n\n\n\n<Badge variant=\"bogus\">a</Badge>";
        let d2 = analyze_file("C.tsx", code2, &opts());
        let p2: Vec<_> = d2
            .iter()
            .filter(|d| d.rule_id == "kumo/validate-kumo-props")
            .collect();
        assert_eq!(p2.len(), 1);
        assert_eq!(p2[0].line, 6);
    }

    #[test]
    fn test_detect_invalid_badge_prop() {
        let code = r#"
            import { Badge } from '@cloudflare/kumo';
            export function MyComp() {
                return <Badge variant="neon-purple">Status</Badge>;
            }
        "#;
        let diagnostics = analyze_file("MyComp.tsx", code, &opts());
        assert!(diagnostics
            .iter()
            .any(|d| d.rule_id == "kumo/validate-kumo-props"));
    }

    #[test]
    fn test_vanilla_styling_mode() {
        let code_jsx = r#"
            export function MyComp() {
                return <div className="bg-red-500">Hello</div>;
            }
        "#;
        let mut options = opts();
        options.styling_mode = Some("vanilla".to_string());
        let diagnostics = analyze_file("MyComp.tsx", code_jsx, &options);
        assert_eq!(diagnostics.len(), 0);

        let code_css = r#"
            @import "@cloudflare/kumo/styles/css";
        "#;
        let diagnostics_css = analyze_file("index.css", code_css, &options);
        assert_eq!(diagnostics_css.len(), 0);
    }

    #[test]
    fn test_detect_forbidden_imports() {
        let code = r#"
            import { PageHeader, Button } from '@cloudflare/kumo';
            export function MyPage() { return <Button>Click</Button>; }
        "#;
        let diagnostics = analyze_file("MyPage.tsx", code, &opts());
        assert!(diagnostics
            .iter()
            .any(|d| d.rule_id == "kumo/no-forbidden-imports"));
    }

    #[test]
    fn test_detect_raw_links() {
        let code = r#"
            export function MyLink() {
                return <a href="/about">About Us</a>;
            }
        "#;
        let diagnostics = analyze_file("MyLink.tsx", code, &opts());
        assert!(diagnostics.iter().any(|d| d.rule_id == "kumo/no-raw-links"));
    }

    /// M-8: `rawLinks` is independently configurable but inherits `rawControls`.
    #[test]
    fn test_raw_links_severity_is_independent() {
        let code = r#"<a href="/about">About</a>"#;

        let mut inherit_off = opts();
        inherit_off.raw_controls = Severity::Off;
        assert_eq!(
            count(
                &analyze_file("L.tsx", code, &inherit_off),
                "kumo/no-raw-links"
            ),
            0
        );

        let mut only_links_off = opts();
        only_links_off.raw_links = Some(Severity::Off);
        assert_eq!(
            count(
                &analyze_file("L.tsx", code, &only_links_off),
                "kumo/no-raw-links"
            ),
            0
        );

        let mut links_on_controls_off = opts();
        links_on_controls_off.raw_controls = Severity::Off;
        links_on_controls_off.raw_links = Some(Severity::Error);
        let d = analyze_file("L.tsx", code, &links_on_controls_off);
        assert_eq!(count(&d, "kumo/no-raw-links"), 1);
        assert_eq!(d[0].severity, "error");
    }

    #[test]
    fn test_detect_fouc_script() {
        let bad_html = r#"
            <!DOCTYPE html>
            <html>
                <head><title>App</title></head>
                <body><div id="root"></div></body>
            </html>
        "#;
        let diagnostics = analyze_file("index.html", bad_html, &opts());
        assert!(diagnostics
            .iter()
            .any(|d| d.rule_id == "kumo/check-fouc-script"));

        let good_html = r#"
            <!DOCTYPE html>
            <html>
                <head>
                    <title>App</title>
                    <script>
                        document.documentElement.setAttribute('data-mode', localStorage.getItem('theme') || 'light');
                    </script>
                </head>
                <body><div id="root"></div></body>
            </html>
        "#;
        let diagnostics_good = analyze_file("index.html", good_html, &opts());
        assert_eq!(diagnostics_good.len(), 0);
    }

    /// L-4: `data-mode` in the body is not a theme-init script.
    #[test]
    fn test_fouc_only_counts_head() {
        let html = r#"<html><head><title>x</title></head><body><div data-mode="dark"></div></body></html>"#;
        let diagnostics = analyze_file("index.html", html, &opts());
        assert_eq!(count(&diagnostics, "kumo/check-fouc-script"), 1);
    }

    #[test]
    fn test_kumo_components_not_flagged_as_raw() {
        let code = r##"
            import { Button, Input, Select, Textarea, Link } from '@cloudflare/kumo';
            export function MyComp() {
                return (
                    <div>
                        <Button variant="primary">Click</Button>
                        <Input placeholder="Enter..." />
                        <Select size="sm"><option>1</option></Select>
                        <Textarea />
                        <Link href="#">Link</Link>
                    </div>
                );
            }
        "##;
        let diagnostics = analyze_file("MyComp.tsx", code, &opts());
        assert_eq!(count(&diagnostics, "kumo/no-raw-controls"), 0);
        assert_eq!(count(&diagnostics, "kumo/no-raw-links"), 0);
    }

    #[test]
    fn test_banner_variant_validation() {
        let valid = analyze_file(
            "Banner.tsx",
            r#"<Banner variant="error" title="Error" />"#,
            &opts(),
        );
        assert_eq!(count(&valid, "kumo/validate-kumo-props"), 0);

        let invalid = analyze_file(
            "Banner.tsx",
            r#"<Banner variant="invalid-var" title="Test" />"#,
            &opts(),
        );
        assert_eq!(count(&invalid, "kumo/validate-kumo-props"), 1);
    }

    #[test]
    fn test_multiple_raw_controls_single_line() {
        let code = r#"export function Multi() { return <div><button>One</button><button>Two</button><input /></div>; }"#;
        let diagnostics = analyze_file("Multi.tsx", code, &opts());
        assert_eq!(count(&diagnostics, "kumo/no-raw-controls"), 3);
    }

    /// M-2: raw controls whose tag name ends the line must still be detected.
    #[test]
    fn test_multiline_raw_controls() {
        let button = "<button\n  type=\"button\"\n>Click</button>";
        assert_eq!(
            count(
                &analyze_file("M.tsx", button, &opts()),
                "kumo/no-raw-controls"
            ),
            1
        );

        let anchor = "<a\n  href=\"/x\"\n>Link</a>";
        assert_eq!(
            count(&analyze_file("M.tsx", anchor, &opts()), "kumo/no-raw-links"),
            1
        );
    }

    /// `<a\b` must not match `<abbr>`, `<article>`; `<button\b` must not match `<buttonish>`.
    #[test]
    fn test_raw_tag_regexes_do_not_overmatch() {
        let code = "<article><abbr title=\"x\">y</abbr></article><buttonish />";
        let diagnostics = analyze_file("O.tsx", code, &opts());
        assert_eq!(count(&diagnostics, "kumo/no-raw-links"), 0);
        assert_eq!(count(&diagnostics, "kumo/no-raw-controls"), 0);
    }

    #[test]
    fn test_url_in_string_not_stripped_as_comment() {
        let code = r##"export function UrlComp() { return <div style={{color:"#ff0000"}} data-url="https://example.com/test">ok</div>; }"##;
        let diagnostics = analyze_file("UrlComp.tsx", code, &opts());
        assert_eq!(count(&diagnostics, "kumo/no-hardcoded-colors"), 1);
    }

    #[test]
    fn test_multiline_jsx_tag_prop_validation() {
        let code = "export function MultiLine() {\n  return (\n    <Button\n      onClick={() => setOpen(false)}\n      variant=\"invalid-variant\"\n    >\n      Click\n    </Button>\n  );\n}";
        let diagnostics = analyze_file("MultiLine.tsx", code, &opts());
        let props: Vec<_> = diagnostics
            .iter()
            .filter(|d| d.rule_id == "kumo/validate-kumo-props")
            .collect();
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].line, 3);
    }

    /// M-4: JSX rules must not run over plain `.ts`/`.js` modules.
    #[test]
    fn test_plain_ts_and_js_are_not_scanned_as_jsx() {
        let code = r#"export const s = "<button> bg-red-500 dark:foo";"#;
        assert_eq!(analyze_file("util.ts", code, &opts()).len(), 0);
        assert_eq!(analyze_file("util.js", code, &opts()).len(), 0);
        assert_eq!(analyze_file("util.tsx", code, &opts()).len(), 0);
    }

    /// L-3: only 3, 4, 6 and 8-digit hex runs are colors.
    #[test]
    fn test_hex_color_lengths() {
        let seven = r##"<div style={{ color: "#abcdefa" }} />"##;
        assert_eq!(
            count(
                &analyze_file("H.tsx", seven, &opts()),
                "kumo/no-hardcoded-colors"
            ),
            0
        );

        let six = r##"<div style={{ color: "#abcdef" }} />"##;
        assert_eq!(
            count(
                &analyze_file("H.tsx", six, &opts()),
                "kumo/no-hardcoded-colors"
            ),
            1
        );

        let three = r##"<div style={{ color: "#fff" }} />"##;
        assert_eq!(
            count(
                &analyze_file("H.tsx", three, &opts()),
                "kumo/no-hardcoded-colors"
            ),
            1
        );
    }

    /// H-1: hex detection no longer depends on the line mentioning `className`.
    #[test]
    fn test_hex_detected_outside_class_attributes() {
        let code = r##"const BRAND = "#f6821f";"##;
        assert_eq!(
            count(
                &analyze_file("T.tsx", code, &opts()),
                "kumo/no-hardcoded-colors"
            ),
            1
        );
    }

    /// H-1: columns are counted in Unicode scalar values, not bytes.
    #[test]
    fn test_columns_are_character_based() {
        let code = r##"<div title="•" style={{ color: "#ff0000" }} />"##;
        let diagnostics = analyze_file("U.tsx", code, &opts());
        let hit = diagnostics
            .iter()
            .find(|d| d.rule_id == "kumo/no-hardcoded-colors")
            .expect("expected a hex color diagnostic");
        let byte_off = code.find("#ff0000").unwrap();
        assert_eq!(hit.column, code[..byte_off].chars().count() as u32 + 1);
        // 33 in characters; the `•` is 3 bytes, so a byte-based column would
        // report 35. That gap is the regression this test exists for.
        assert_eq!(hit.column, 33);
        // The `•` is 3 bytes, so a byte-based column would report 35 here.
        // That gap is the regression this test exists for.
        assert_eq!(code[..byte_off].len() + 1, 35);
    }

    /// N-1: an unclosed `/*` inside a multi-line template literal must not
    /// blank the rest of the file.
    #[test]
    fn test_block_comment_inside_multiline_template_is_inert() {
        let code = "const q = `\n  /* not a comment, just SQL\n`;\nconst c = \"#ff0000\";\n<Badge variant=\"bogus\">y</Badge>";
        let diagnostics = analyze_file("T.tsx", code, &opts());
        assert_eq!(
            count(&diagnostics, "kumo/no-hardcoded-colors"),
            1,
            "found: {:?}",
            diagnostics
        );
        assert_eq!(
            count(&diagnostics, "kumo/validate-kumo-props"),
            1,
            "found: {:?}",
            diagnostics
        );
    }

    /// N-2: `//` inside a multi-line template is data, not a comment.
    #[test]
    fn test_line_comment_inside_multiline_template_is_inert() {
        let code = "const u = `\nhttps://example.com #ff0000\n`;";
        let diagnostics = analyze_file("T.tsx", code, &opts());
        assert_eq!(
            count(&diagnostics, "kumo/no-hardcoded-colors"),
            1,
            "found: {:?}",
            diagnostics
        );
    }

    /// Real comments still work when a template literal is in the same file.
    #[test]
    fn test_comments_still_masked_around_templates() {
        let code = "const q = `text`;\n// <button> bg-red-500\n/* dark:x */\n<div className=\"bg-kumo-base\">ok</div>";
        assert_eq!(analyze_file("T.tsx", code, &opts()).len(), 0);
    }

    /// `${ … }` inside a template returns to code context, so comments there
    /// are still comments.
    #[test]
    fn test_template_expression_is_code_context() {
        let code =
            "const q = `a ${ /* bg-red-500 */ x } b`;\n<div className=\"bg-kumo-base\">ok</div>";
        assert_eq!(analyze_file("T.tsx", code, &opts()).len(), 0);
    }

    /// N-3: an escaped `/` belongs to a regex literal, not a comment.
    #[test]
    fn test_escaped_slashes_in_regex_are_not_a_comment() {
        let code = r##"const re = /https:\/\//; const c = "#ff0000";"##;
        let diagnostics = analyze_file("R.tsx", code, &opts());
        assert_eq!(
            count(&diagnostics, "kumo/no-hardcoded-colors"),
            1,
            "found: {:?}",
            diagnostics
        );
    }

    /// N-5: markup inside a string literal is not real JSX.
    #[test]
    fn test_jsx_inside_string_literal_is_not_validated() {
        for code in [
            r#"const s = "<Badge variant='bogus'>";"#,
            r#"const s = '<Badge variant="bogus">';"#,
            "const s = `<Badge variant='bogus'>`;",
            r#"render("<Badge variant='bogus'>");"#,
        ] {
            let diagnostics = analyze_file("S.tsx", code, &opts());
            assert_eq!(
                count(&diagnostics, "kumo/validate-kumo-props"),
                0,
                "code: {}",
                code
            );
        }
    }

    /// …but an apostrophe in JSX text must not swallow the tags around it.
    #[test]
    fn test_apostrophe_in_jsx_text_does_not_hide_tags() {
        let code = "<p>Don't stop</p>\n<Badge variant=\"bogus\">y</Badge>";
        let diagnostics = analyze_file("S.tsx", code, &opts());
        assert_eq!(
            count(&diagnostics, "kumo/validate-kumo-props"),
            1,
            "found: {:?}",
            diagnostics
        );
    }

    /// Real JSX attributes are still read after the string-skipping change.
    #[test]
    fn test_attribute_strings_still_validated() {
        let code = r#"<Badge variant="bogus" title="x">y</Badge>"#;
        assert_eq!(
            count(
                &analyze_file("S.tsx", code, &opts()),
                "kumo/validate-kumo-props"
            ),
            1
        );
    }

    /// N-4: the tag scan is bounded, so unterminated tags stay near-linear.
    #[test]
    fn test_unterminated_tag_scan_is_bounded() {
        let mut code = String::new();
        for _ in 0..2000 {
            code.push_str("const s = \"<Foo\";\n");
        }
        code.push_str("<Badge variant=\"bogus\">x</Badge>");

        let start = std::time::Instant::now();
        let diagnostics = analyze_file("B.tsx", &code, &opts());
        let elapsed = start.elapsed();

        assert_eq!(count(&diagnostics, "kumo/validate-kumo-props"), 1);
        assert!(
            elapsed.as_millis() < 400,
            "unterminated-tag scan took {elapsed:?}; the lookahead bound is not working"
        );
    }

    /// M-7: CSS rules honour a configurable severity.
    #[test]
    fn test_css_directive_severity_is_configurable() {
        let css = "body { color: red; }";

        let d = analyze_file("index.css", css, &opts());
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].severity, "error");

        let mut warn = opts();
        warn.css_directives = Severity::Warn;
        assert_eq!(analyze_file("index.css", css, &warn)[0].severity, "warn");

        let mut off = opts();
        off.css_directives = Severity::Off;
        assert_eq!(analyze_file("index.css", css, &off).len(), 0);
    }

    #[test]
    fn test_multiline_forbidden_import_and_exact_column() {
        let code =
            "const x = 1;\n  import {\n    Button,\n    PageHeader,\n  } from '@cloudflare/kumo';";
        let diagnostics = analyze_file("Page.tsx", code, &opts());
        let hit = diagnostics
            .iter()
            .find(|d| d.rule_id == "kumo/no-forbidden-imports")
            .expect("expected forbidden import");
        assert_eq!((hit.line, hit.column), (2, 3));
    }

    #[test]
    fn test_commented_forbidden_import_is_ignored() {
        let code = "/* import {\n PageHeader\n} from '@cloudflare/kumo'; */";
        assert_eq!(
            count(
                &analyze_file("Page.tsx", code, &opts()),
                "kumo/no-forbidden-imports"
            ),
            0
        );
    }

    #[test]
    fn test_raw_markup_inside_js_strings_is_ignored() {
        for code in [
            r#"const a = "<button>not JSX</button>";"#,
            r#"const a = '<input />';"#,
            "const a = String.raw`<a href='/'>not JSX</a>`;",
            r#"return "<textarea />";"#,
        ] {
            let diagnostics = analyze_file("Strings.tsx", code, &opts());
            assert_eq!(count(&diagnostics, "kumo/no-raw-controls"), 0, "{code}");
            assert_eq!(count(&diagnostics, "kumo/no-raw-links"), 0, "{code}");
        }
    }

    #[test]
    fn test_expression_wrapped_static_props_are_validated() {
        for code in [
            r#"<Badge variant={"bogus"} />"#,
            r#"<Badge variant={'bogus'} />"#,
            r#"<Badge variant={`bogus`} />"#,
        ] {
            assert_eq!(
                count(
                    &analyze_file("Props.tsx", code, &opts()),
                    "kumo/validate-kumo-props"
                ),
                1,
                "{code}"
            );
        }
        assert_eq!(
            count(
                &analyze_file("Props.tsx", r#"<Badge variant={variant} />"#, &opts()),
                "kumo/validate-kumo-props"
            ),
            0
        );
    }

    #[test]
    fn test_second_same_line_tag_has_correct_column() {
        let code = r#"<Badge variant="error" /> <Badge variant="bogus" />"#;
        let hit = analyze_file("Columns.tsx", code, &opts())
            .into_iter()
            .find(|d| d.rule_id == "kumo/validate-kumo-props")
            .expect("expected invalid prop");
        assert_eq!(hit.column, code.rfind("<Badge").unwrap() as u32 + 1);
    }

    #[test]
    fn test_css_directives_require_real_uncommented_statements() {
        let mut vanilla = opts();
        vanilla.styling_mode = Some("vanilla".to_string());
        for css in [
            "/* @import '@cloudflare/kumo/styles/css'; */",
            ".note::after { content: \"@import '@cloudflare/kumo/styles/css'\"; }",
            ".note::after { content: '@import @cloudflare/kumo/styles/css'; }",
            "@import 'other.css'; /* @cloudflare/kumo/styles/css */",
        ] {
            assert_eq!(
                count(
                    &analyze_file("index.css", css, &vanilla),
                    "kumo/check-kumo-css-import"
                ),
                1,
                "{css}"
            );
        }
        assert_eq!(
            count(
                &analyze_file(
                    "index.css",
                    "@import '@cloudflare/kumo/styles/theme-kumo.css';",
                    &vanilla
                ),
                "kumo/check-kumo-css-import"
            ),
            0
        );

        let fake_tailwind = "/* @source '../node_modules/@cloudflare/kumo/dist/**/*'; */\n@import 'other.css';\n.note { content: '@cloudflare/kumo/styles/tailwind'; }";
        assert_eq!(
            count(
                &analyze_file("index.css", fake_tailwind, &opts()),
                "kumo/check-tailwind-v4-kumo-source"
            ),
            1
        );
        let valid_tailwind = "@source '../node_modules/@cloudflare/kumo/dist/**/*';\n@import '@cloudflare/kumo/styles/tailwind';";
        assert_eq!(
            count(
                &analyze_file("index.css", valid_tailwind, &opts()),
                "kumo/check-tailwind-v4-kumo-source"
            ),
            0
        );
    }

    #[test]
    fn test_css_hex_colors_are_detected_but_comments_are_ignored() {
        let css = "/* color: #fff; */\n.rule { color: #1a2b3c; }";
        let diagnostics = analyze_file("theme.css", css, &opts());
        let colors: Vec<_> = diagnostics
            .iter()
            .filter(|d| d.rule_id == "kumo/no-hardcoded-colors")
            .collect();
        assert_eq!(colors.len(), 1);
        assert_eq!((colors[0].line, colors[0].column), (2, 16));
    }

    #[test]
    fn test_fouc_requires_uncommented_head_script_mutation() {
        for html in [
            "<html><head><!-- <script>document.documentElement.setAttribute('data-mode', 'dark')</script> --></head></html>",
            "<html><head><meta data-mode='dark'><script>localStorage.getItem('theme')</script></head></html>",
            "<html><head><script>/* document.documentElement.setAttribute('data-mode', 'dark') */</script></head></html>",
            "<html><head><script>console.log('data-mode')</script></head></html>",
        ] {
            assert_eq!(
                count(&analyze_file("index.html", html, &opts()), "kumo/check-fouc-script"),
                1,
                "{html}"
            );
        }
        let valid = "<html><head><script>document.documentElement.dataset.mode = savedTheme;</script></head></html>";
        assert_eq!(
            count(
                &analyze_file("index.html", valid, &opts()),
                "kumo/check-fouc-script"
            ),
            0
        );
    }

    #[test]
    fn test_comment_markers_inside_regex_do_not_mask_following_code() {
        let code = r##"const commentChars = /[/*]/; const color = "#ff0000";"##;
        assert_eq!(
            count(
                &analyze_file("Regex.tsx", code, &opts()),
                "kumo/no-hardcoded-colors"
            ),
            1
        );
    }
}
