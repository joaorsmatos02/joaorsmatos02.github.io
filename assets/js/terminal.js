/* ------------------------------------------------------------------ *
 * terminal.js — the side-panel terminal (controller)
 *
 *  · Default: a live cbonsai screensaver (see bonsai.js) in the panel.
 *    Type "cmd" to reopen it, Esc / ✕ to close.
 *
 *  · Easter egg: type "imin" — the screensaver "glitches" (a fake heap
 *    overflow in the leaf buffer) and breaks out into an interactive
 *    shell over the fake filesystem (see filesystem.js).
 *    "exit" returns to the bonsai; Esc hides the whole panel.
 *
 * Depends on window.Cbonsai and window.FakeFS (loaded before this file).
 * ------------------------------------------------------------------ */
(function () {
    "use strict";

    var FakeFS = window.FakeFS;
    var nodeAt = FakeFS.nodeAt, resolve = FakeFS.resolve, pathStr = FakeFS.pathStr,
        baseName = FakeFS.baseName, isExe = FakeFS.isExe, HOME = FakeFS.HOME;

    /* =================================================================
     *  panel plumbing
     * ================================================================= */

    var panel, grower = null, timers = [], running = false, mode = "bonsai";
    var reopenHint = null;

    // small "cmd to open" hint shown in the corner while the panel is closed
    function ensureReopenHint() {
        if (reopenHint) return;
        reopenHint = document.createElement("div");
        reopenHint.id = "term-reopen";
        reopenHint.textContent = "cmd to open";
        reopenHint.title = "reopen the terminal";
        reopenHint.addEventListener("click", open);
        document.body.appendChild(reopenHint);
    }
    function showReopenHint() { ensureReopenHint(); reopenHint.classList.add("show"); }
    function hideReopenHint() { if (reopenHint) reopenHint.classList.remove("show"); }

    function clearTimers() {
        timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
        timers = [];
    }

    function build() {
        panel = document.createElement("div");
        panel.id = "bonsai-term";
        panel.innerHTML =
            '<div class="bar"><span class="title">cbonsai — joao@cs</span>' +
            '<span class="dots">● ● <span class="x" title="close (esc)">✕</span></span></div>' +
            '<div class="body"></div>' +
            '<div class="hint">esc to close</div>';
        document.body.appendChild(panel);
        panel.querySelector(".x").addEventListener("click", close);
        panel.addEventListener("click", function (e) {
            if (mode !== "shell" || !shIn) return;
            if (e.target.classList.contains("x")) return;
            if (window.getSelection && String(window.getSelection())) return; // keep text selectable
            shIn.focus();
        });
        buildBonsaiUI();
    }

    function buildBonsaiUI() {
        panel.classList.remove("hacked");
        var title = panel.querySelector(".title");
        if (title) title.textContent = "cbonsai — joao@cs";
        var body = panel.querySelector(".body");
        body.innerHTML =
            '<div class="cmdline">joao@cs:~$ <b>cbonsai --live --infinite</b> <span class="cur"> </span></div>' +
            '<pre></pre>';
        grower = window.Cbonsai.createGrower(body.querySelector("pre"));
    }

    /* =================================================================
     *  open / close  (bonsai is the default state)
     * ================================================================= */

    function remember(isClosed) {
        try {
            if (isClosed) sessionStorage.setItem("terminal-closed", "1");
            else sessionStorage.removeItem("terminal-closed");
        } catch (e) { /* storage unavailable — no persistence, no harm */ }
    }

    function open() {
        if (running) return;
        if (!panel) build();
        running = true;
        mode = "bonsai";
        panel.classList.add("on");
        document.body.classList.add("terminal-open");
        hideReopenHint();
        remember(false);
        if (grower) grower.start();
    }

    function close() {
        if (!running) return;
        running = false;
        if (grower) grower.stop();
        clearTimers();
        panel.classList.remove("on", "glitching");
        document.body.classList.remove("terminal-open");
        if (mode === "shell") { mode = "bonsai"; buildBonsaiUI(); }
        showReopenHint();
        remember(true);
    }

    /* =================================================================
     *  breakout into the shell
     * ================================================================= */

    function enterShell() {
        if (mode === "shell") return;
        if (!running) open();      // makes sure the panel is visible
        mode = "shell";
        if (grower) grower.stop();  // stop the bonsai
        clearTimers();
        var t = setTimeout(function () {
            buildShellUI();
        }, 1100);
        timers.push(t);
    }

    function exitShell() {
        if (mode !== "shell") return;
        clearTimers();
        mode = "bonsai";
        buildBonsaiUI();
        if (grower) grower.start();
    }

    /* =================================================================
     *  the shell UI + command interpreter
     * ================================================================= */

    var CWD = HOME.slice();
    var CMDS = ["help", "ls", "cat", "cd", "pwd", "whoami", "echo", "clear", "doom", "./doom", "cbonsai", "exit", "sudo"];
    var shOut, shIn, shPs, shPre, shCur, shPost, history = [], histPos = 0;

    function promptText() { return "joao@cs:" + pathStr(CWD) + "$"; }

    function buildShellUI() {
        panel.classList.add("hacked");
        var title = panel.querySelector(".title");
        if (title) title.textContent = "sh — joao@cs";
        var body = panel.querySelector(".body");
        // the real <input> is invisible (it only captures keys/clicks); the
        // visible line is mirrored into spans so we can draw a block cursor.
        body.innerHTML =
            '<div class="sh-out"></div>' +
            '<div class="sh-line">' +
            '<span class="sh-ps"></span> ' +
            '<span class="sh-render"><span class="sh-pre"></span>' +
            '<span class="sh-cursor"> </span><span class="sh-post"></span></span>' +
            '<input class="sh-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="terminal input">' +
            '</div>';
        shOut = body.querySelector(".sh-out");
        shIn = body.querySelector(".sh-in");
        shPs = body.querySelector(".sh-ps");
        shPre = body.querySelector(".sh-pre");
        shCur = body.querySelector(".sh-cursor");
        shPost = body.querySelector(".sh-post");
        CWD = HOME.slice(); history = []; histPos = 0;
        updatePrompt();
        shIn.addEventListener("keydown", onShellKey);
        shIn.addEventListener("keyup", renderLine);
        shIn.addEventListener("input", renderLine);
        shIn.addEventListener("focus", caretEnd);
        shIn.addEventListener("click", caretEnd);
        renderLine();
        printBanner();
        setTimeout(function () { if (shIn) shIn.focus(); }, 0);
    }

    function updatePrompt() { if (shPs) shPs.textContent = promptText(); }

    // mirror the input's value + caret into the visible line (block cursor)
    function renderLine() {
        if (!shIn) return;
        var v = shIn.value;
        var pos = shIn.selectionStart;
        if (pos === null || pos === undefined) pos = v.length;
        shPre.textContent = v.slice(0, pos);
        var under = v.charAt(pos);
        shCur.textContent = under !== "" ? under : " ";
        shPost.textContent = v.slice(pos + (under !== "" ? 1 : 0));
    }

    function caretEnd() {
        setTimeout(function () {
            if (!shIn) return;
            try { shIn.selectionStart = shIn.selectionEnd = shIn.value.length; } catch (e) { }
            renderLine();
        }, 0);
    }

    function scrollBottom() {
        var b = panel && panel.querySelector(".body");
        if (b) b.scrollTop = b.scrollHeight;
    }

    function out(text, cls) {
        var d = document.createElement("div");
        if (cls) d.className = cls;
        d.textContent = text;
        shOut.appendChild(d);
        scrollBottom();
        return d;
    }

    function echoCmd(line) {
        var d = document.createElement("div");
        var ps = document.createElement("span");
        ps.className = "ps";
        ps.textContent = promptText() + " ";
        d.appendChild(ps);
        d.appendChild(document.createTextNode(line));
        shOut.appendChild(d);
    }

    function printBanner() {
        var lines = [
            "",
            "[*] cbonsai 1.3.7 — reading --leaf buffer",
            "[!] heap overflow: leaf glyph count exceeds chunk size",
            "[!] saved return address @ 0x00405e10 overwritten",
            "[+] rop chain staged · mprotect(rwx) ok",
            "[+] breakout successful — dropping to /bin/sh",
            "",
            "type 'help' to look around. 'exit' reloads the shell.",
            ""
        ];
        var i = 0;
        (function next() {
            if (i >= lines.length) return;
            var l = lines[i], cls = null;
            if (l.indexOf("[!]") === 0) cls = "err";
            else if (l.indexOf("[+]") === 0) cls = "ok";
            else if (l.indexOf("[*]") === 0) cls = "sys";
            else if (l && l.charAt(0) !== "[") cls = "sys";
            out(l, cls);
            i++;
            var t = setTimeout(next, 90);
            timers.push(t);
        })();
    }

    var HELP = [
        "commands:",
        "  help            this message",
        "  ls [-a] [dir]   list files",
        "  cat <file>      print a file",
        "  cd [dir]        change directory",
        "  pwd             print working directory",
        "  whoami          who you are",
        "  doom            launch DOOM in the browser",
        "  clear           clear the screen   (Ctrl+L)",
        "  exit            reload the shell"
    ].join("\n");

    var DOOM = [
        " ____   ___   ___  __  __",
        "|  _ \\ / _ \\ / _ \\|  \\/  |",
        "| | | | | | | | | | |\\/| |",
        "| |_| | |_| | |_| | |  | |",
        "|____/ \\___/ \\___/|_|  |_|"
    ].join("\n");

    function run(line) {
        var argv = line.trim().split(/\s+/).filter(Boolean);
        if (argv.length) {
            var cmd = argv[0], args = argv.slice(1);
            switch (cmd) {
                case "help": out(HELP); break;
                case "ls": cmdLs(args); break;
                case "cat": cmdCat(args); break;
                case "cd": cmdCd(args); break;
                case "pwd": out("/" + CWD.join("/")); break;
                case "whoami": out("joao"); break;
                case "echo": out(args.join(" ")); break;
                case "clear": shOut.innerHTML = ""; break;
                case "doom": case "./doom": cmdDoom(); break;
                case "cbonsai": case "exit": exitShell(); return;
                case "sudo": out("nice try. this incident will be reported. :)", "sys"); break;
                case "rm": out("rm: permission denied (this is a portfolio, please don't)", "err"); break;
                case "cowsay": out(args.join(" ") || "moo", "sys"); break;
                default: out(cmd + ": command not found", "err");
            }
        }
        updatePrompt();
        scrollBottom();
    }

    function cmdLs(args) {
        var showHidden = args.indexOf("-a") >= 0;
        var pathArgs = args.filter(function (a) { return a.charAt(0) !== "-"; });
        var target = pathArgs.length ? resolve(pathArgs[0], CWD) : CWD.slice();
        var node = nodeAt(target);
        if (!node) { out("ls: cannot access '" + pathArgs[0] + "': No such file or directory", "err"); return; }
        if (node.t === "file") { out(baseName(target)); return; }
        var names = Object.keys(node.c).filter(function (n) { return showHidden || n.charAt(0) !== "."; }).sort();
        if (!names.length) return;
        var d = document.createElement("div");
        d.className = "ls";
        names.forEach(function (n) {
            var span = document.createElement("span");
            var child = node.c[n];
            span.textContent = n + (child.t === "dir" ? "/" : "");
            span.className = child.t === "dir" ? "dir" : (isExe(n) ? "exe" : "");
            d.appendChild(span);
            d.appendChild(document.createTextNode("  "));
        });
        shOut.appendChild(d);
        scrollBottom();
    }

    function cmdCat(args) {
        if (!args.length) { out("cat: missing operand", "err"); return; }
        var p = resolve(args[0], CWD), node = nodeAt(p);
        if (!node) { out("cat: " + args[0] + ": No such file or directory", "err"); return; }
        if (node.t === "dir") { out("cat: " + args[0] + ": Is a directory", "err"); return; }
        if (isExe(baseName(p))) { out("cat: " + args[0] + ": binary file — try running it ('doom')", "sys"); return; }
        out(node.c);
    }

    function cmdCd(args) {
        var p = args.length ? resolve(args[0], CWD) : HOME.slice(), node = nodeAt(p);
        if (!node) { out("cd: " + args[0] + ": No such file or directory", "err"); return; }
        if (node.t !== "dir") { out("cd: " + args[0] + ": Not a directory", "err"); return; }
        CWD = p;
    }

    function cmdDoom() {
        out("loading DOOM ...", "sys");
        var t = setTimeout(function () {
            out(DOOM, "ok");
            out("[doom] launching browser engine...", "sys");
            scrollBottom();
            window.location.href = "doom.html";
        }, 650);
        timers.push(t);
    }

    /* ---- input handling: enter / history / tab / ctrl ---------------- */

    function commonPrefix(arr) {
        if (!arr.length) return "";
        var p = arr[0];
        for (var i = 1; i < arr.length; i++) {
            while (arr[i].indexOf(p) !== 0) p = p.slice(0, -1);
        }
        return p;
    }

    function tabComplete() {
        var val = shIn.value;
        var m = val.match(/(\S*)$/), frag = m[1];
        var head = val.slice(0, val.length - frag.length);
        var options;
        if (head.trim() === "") {
            options = CMDS.filter(function (c) { return c.indexOf(frag) === 0; });
        } else {
            var slash = frag.lastIndexOf("/");
            var dirPart = slash >= 0 ? frag.slice(0, slash) : "";
            var base = slash >= 0 ? frag.slice(slash + 1) : frag;
            var node = nodeAt(dirPart ? resolve(dirPart, CWD) : CWD.slice());
            options = (node && node.t === "dir")
                ? Object.keys(node.c).filter(function (n) { return n.indexOf(base) === 0; })
                    .map(function (n) { return (dirPart ? dirPart + "/" : "") + n + (node.c[n].t === "dir" ? "/" : ""); })
                : [];
        }
        if (options.length === 1) {
            shIn.value = head + options[0];
        } else if (options.length > 1) {
            out(options.join("  "), "sys");
            var cp = commonPrefix(options);
            if (cp.length > frag.length) shIn.value = head + cp;
        }
    }

    function onShellKey(e) {
        if (e.key === "Enter") {
            var line = shIn.value;
            echoCmd(line);
            if (line.trim()) history.push(line);
            histPos = history.length;
            shIn.value = "";
            run(line);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (history.length) { histPos = Math.max(0, histPos - 1); shIn.value = history[histPos] || ""; }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            histPos = Math.min(history.length, histPos + 1);
            shIn.value = history[histPos] || "";
            return;
        }
        if (e.key === "Tab") { e.preventDefault(); tabComplete(); return; }
        if (e.ctrlKey && (e.key === "l" || e.key === "L")) { e.preventDefault(); shOut.innerHTML = ""; return; }
        if (e.ctrlKey && (e.key === "c" || e.key === "C")) { e.preventDefault(); echoCmd(shIn.value); shIn.value = ""; return; }
    }

    /* =================================================================
     *  triggers
     * ================================================================= */

    var startClosed = false;
    try { startClosed = sessionStorage.getItem("terminal-closed") == "1"; } catch (e) { /* storage unavailable */ }
    if (startClosed) showReopenHint(); else open();

    var buf = "";
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { close(); return; } // Esc always hides; only "exit" reloads
        if (mode === "shell") return;               // let the shell input own the keyboard
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key && e.key.length === 1) {
            buf = (buf + e.key.toLowerCase()).slice(-4);
            if (buf.slice(-4) === "imin") { buf = ""; enterShell(); }
            else if (buf.slice(-3) === "cmd") { buf = ""; open(); }
        }
    });

})();
