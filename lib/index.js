/**
 * dsh_ux_enhance — host half.
 *
 * Provides no host-side behavior: this is a browser-only plugin. The file
 * exists so the package can be a cordis Loader entry; the browser half is
 * served via the package's `dsh.client` declaration and `./client` export.
 */
function apply() {}

export { apply };
