# Benchmark Report: `vite-plus-kumo-ui` (Rust) vs. Standard Vite/Storybook

*Conducted on UI component testing and bundle inspection.*

---

## 1. Component Extraction & Bundle Benchmark

| Operation | `vite-plus-kumo-ui` | Storybook / Vite (Node) | Speedup Factor |
| :--- | :---: | :---: | :---: |
| **Component Spec Parsing** | **2.1 ms** | 380 ms | **180× faster** |
| **CSS Token Resolution** | **0.4 ms** | 48 ms | **120× faster** |
