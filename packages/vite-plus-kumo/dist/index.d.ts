import { type Plugin } from 'vite';
export type Severity = 'error' | 'warn' | 'off';
export type StylingMode = 'tailwind' | 'vanilla' | 'css' | 'none';
export interface KumoPluginOptions {
    /** Severity level for raw native HTML controls (<button>, <input>, etc.). Default: 'warn' */
    rawControls?: Severity;
    /** Severity level for raw native `<a>` anchors. Defaults to `rawControls`. */
    rawLinks?: Severity;
    /**
     * Severity for hardcoded hex colour literals. Default: 'warn'
     *
     * Class-name colour rules — raw Tailwind palette colours, `bg-white`,
     * `dark:` variants, legacy `cf-*` and unknown `*-kumo-*` tokens — are
     * delegated to `eslint-plugin-better-tailwindcss`.
     */
    hardcodedColors?: Severity;
    /** Severity level for invalid Kumo component props. Default: 'warn' */
    invalidProps?: Severity;
    /** Severity level for the CSS entry-point directive rules. Default: 'error' */
    cssDirectives?: Severity;
    /** Check CSS entry points for required Tailwind v4 Kumo directives. Default: true */
    checkTailwindV4?: boolean;
    /** Styling mode: 'tailwind' (default), 'vanilla' (or 'css'), or 'none'. Default: 'tailwind' */
    stylingMode?: StylingMode;
    /** Alias for stylingMode */
    cssMode?: StylingMode;
    /** Severity level for forbidden direct imports of CLI scaffolded blocks from `@cloudflare/kumo`. Default: 'error' */
    forbiddenImports?: Severity;
    /** Severity level for missing blocking dark-mode initialization script in index.html <head>. Default: 'warn' */
    checkFoucScript?: Severity;
    /** Custom CSS entry point path relative to workspace root */
    cssPath?: string;
    /** Custom ignore patterns */
    ignorePatterns?: string[];
}
export interface KumoDiagnostic {
    ruleId: string;
    line: number;
    column: number;
    message: string;
    suggestion: string;
    severity: string;
}
export interface LintResult {
    filename: string;
    diagnostics: KumoDiagnostic[];
    formattedReport: string;
    hasErrors: boolean;
}
/** Mask every comment in `content`, preserving line and column structure. */
export declare function maskComments(content: string): string;
/** True when the native Rust engine is in use, false when the JS fallback is. */
export declare function isNativeEngine(): boolean;
/**
 * Load shared plugin options from disk.
 *
 * The Vite plugin, the standalone CLI and the drift check all read the same
 * file, so a severity set in one place applies everywhere. Without this the
 * CLI and drift check ran under hard-coded defaults while `vite.config.ts`
 * configured only the dev/build path.
 */
export declare function loadKumoConfig(rootDir?: string): KumoPluginOptions;
export declare function lintCode(filename: string, code: string, options?: KumoPluginOptions): LintResult;
export declare function kumoUiPlugin(options?: KumoPluginOptions): Plugin;
export default kumoUiPlugin;
//# sourceMappingURL=index.d.ts.map