extern crate napi_build;

use std::env;
use std::path::Path;
use std::process::Command;

const GENERATE_ENV: &str = "KUMO_GENERATE_ALLOWLISTS";

fn main() {
    napi_build::setup();

    println!("cargo:rerun-if-env-changed={GENERATE_ENV}");

    // A normal Cargo build must be read-only with respect to committed source.
    // Generation is an explicit maintenance action; once requested, failures are
    // fatal so CI/release jobs cannot accidentally package stale output.
    match env::var(GENERATE_ENV).as_deref() {
        Err(env::VarError::NotPresent) | Ok("") | Ok("0") => return,
        Ok("1") => {}
        Ok(value) => panic!("{GENERATE_ENV} must be '1', '0', or unset; got {value:?}"),
        Err(err) => panic!("could not read {GENERATE_ENV}: {err}"),
    }

    println!(
        "cargo:rerun-if-changed=../../node_modules/@cloudflare/kumo/ai/component-registry.json"
    );
    println!(
        "cargo:rerun-if-changed=../../node_modules/@cloudflare/kumo/dist/styles/theme-kumo.css"
    );
    println!("cargo:rerun-if-changed=../../scripts/generate-allowlists.mjs");

    let script_path = Path::new("../../scripts/generate-allowlists.mjs");
    if !script_path.is_file() {
        panic!(
            "{GENERATE_ENV}=1 but {script_path:?} was not found; refusing to use potentially stale allowlists"
        );
    }

    let status = Command::new("node")
        .arg(script_path)
        .status()
        .unwrap_or_else(|err| {
            panic!("{GENERATE_ENV}=1 but Node.js could not run {script_path:?}: {err}")
        });
    if !status.success() {
        panic!(
            "{GENERATE_ENV}=1 but {script_path:?} exited with {status}; refusing to continue with potentially stale allowlists"
        );
    }
}
