/* ------------------------------------------------------------------ *
 * filesystem.js — the fake filesystem behind the shell easter egg
 *
 * Pure data + path helpers, no DOM. Exposes
 *   window.FakeFS = { FS, HOME, nodeAt, resolve, pathStr, baseName, isExe }
 * resolve(arg, cwd) is stateless — the current directory lives in the
 * terminal, which passes it in.
 * ------------------------------------------------------------------ */
(function () {
    "use strict";

    function D(children) { return { t: "dir", c: children }; }
    function F(text) { return { t: "file", c: text }; }

    var FS = D({
        home: D({
            joao: D({
                "readme.txt": F(
                    "this cmd just runs a bonsai screensaver. they say its leaf\n" +
                    "buffer has an overflow, but honestly i really dont feel like it does.\n" +
                    "what a bunch of nerds.\n"
                ),
                "doom": F("\x7fELF\x02\x01\x01"),
                ".corrupted": D({
                    "flag.txt": F(
                        "FLAG{h34p_0v3rfl0w_1n_th3_l34f_buff3r}\n\n" +
                        "if you found it, tell me — jm\n"
                    )
                })
            })
        })
    });

    var HOME = ["home", "joao"];

    function nodeAt(pathArr) {
        var n = FS;
        for (var i = 0; i < pathArr.length; i++) {
            if (n.t !== "dir" || !n.c[pathArr[i]]) return null;
            n = n.c[pathArr[i]];
        }
        return n;
    }

    function resolve(arg, cwd) {
        var parts, path;
        if (arg === undefined || arg === "" || arg === "~") return HOME.slice();
        if (arg.charAt(0) === "/") { path = []; parts = arg.split("/"); }
        else if (arg.charAt(0) === "~") { path = HOME.slice(); parts = arg.slice(1).split("/"); }
        else { path = cwd.slice(); parts = arg.split("/"); }
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p === "" || p === ".") continue;
            if (p === "..") { if (path.length) path.pop(); continue; }
            path.push(p);
        }
        return path;
    }

    function pathStr(pathArr) {
        if (pathArr.length >= 2 && pathArr[0] === "home" && pathArr[1] === "joao") {
            var rest = pathArr.slice(2);
            return "~" + (rest.length ? "/" + rest.join("/") : "");
        }
        return "/" + pathArr.join("/");
    }

    function baseName(pathArr) { return pathArr[pathArr.length - 1] || ""; }
    function isExe(name) { return name === "doom"; }

    window.FakeFS = {
        FS: FS, HOME: HOME,
        nodeAt: nodeAt, resolve: resolve, pathStr: pathStr,
        baseName: baseName, isExe: isExe
    };
})();
