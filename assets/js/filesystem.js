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
                    "you found the shell. nice.\n\n" +
                    "this box just runs a bonsai screensaver — turns out its leaf\n" +
                    "buffer had an overflow, and here you are.\n\n" +
                    "look around:   ls        cat <file>     cd <dir>\n" +
                    "get out:       exit      (or just press Esc)\n"
                ),
                "about.txt": F(
                    "João Ricardo Silva Matos\n" +
                    "PhD student — Instituto Superior Técnico (Lisbon) &\n" +
                    "Carnegie Mellon University (Pittsburgh).\n" +
                    "software security · program analysis · formal methods.\n\n" +
                    "the rest of the site is my CV — try the nav on the left.\n"
                ),
                "research.txt": F(
                    "interests: software security, program analysis, formal\n" +
                    "methods, symbolic execution.\n\n" +
                    "current work: externalizing concretization & state-merging\n" +
                    "policies in a symbolic execution engine (AVD). designed the\n" +
                    "CSml / MCml policy languages, a VSCode extension for them, and\n" +
                    "a testing framework for SE engines.\n"
                ),
                "projects.txt": F(
                    "- AVD symbolic executor — CSml / MCml policy languages\n" +
                    "- SE-Modeling-Languages — VSCode extension\n" +
                    "- this site — a view-source themed portfolio (+ a bonsai)\n\n" +
                    "open the 'projects' page on the left for the full write-up.\n"
                ),
                "contact.txt": F(
                    "email    joao.silva.matos@tecnico.ulisboa.pt\n" +
                    "github   github.com/joaorsmatos02\n"
                ),
                "doom": F("\x7fELF\x02\x01\x01  ...  (executable — try running it)"),
                ".bash_history": F(
                    "cbonsai -l\n" +
                    "sudo apt install cowsay\n" +
                    "cd .corrupted\n" +
                    "cat flag.txt\n" +
                    "clear\n"
                ),
                ".corrupted": D({
                    "flag.txt": F(
                        "FLAG{h34p_0v3rfl0w_1n_th3_l34f_buff3r}\n\n" +
                        "you actually dug this out. respect.\n" +
                        "if you found it, tell me — jrm.\n"
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
