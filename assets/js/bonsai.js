/* ------------------------------------------------------------------ *
 * bonsai.js — cbonsai growth algorithm
 *
 * A self-contained JS port of cbonsai's branch/setDeltas recursion
 * (https://gitlab.com/jallbrit/cbonsai). Pure: no DOM, no state.
 * Exposes  window.Cbonsai = { generate(cols, rows), POT }.
 * ------------------------------------------------------------------ */
(function () {
    "use strict";

    var MULT = 5;          // cbonsai --multiplier
    var LIFESTART = 32;    // cbonsai --life
    var LEAVES = ["&"];    // cbonsai --leaf (default)
    var MAX_STEPS = 2500;  // safety cap against runaway recursion

    var irand = function (n) { return Math.floor(Math.random() * n); };

    var POT = [
        ":___________./~~~\\.___________:",
        " \\                           /",
        "  \\_________________________/",
        "  (_)                     (_)"
    ];

    function generate(cols, rows) {
        var steps = [];
        var shootCounter = 0;
        var potTopRow = rows - 4;

        function setDeltas(type, life, age) {
            var dx = 0, dy = 0, d;
            if (type === "trunk") {
                if (age <= 2 || life < 4) { dy = 0; dx = irand(3) - 1; }
                else if (age < MULT * 3) {
                    dy = (age % Math.floor(MULT * 0.5) === 0) ? -1 : 0;
                    d = irand(10);
                    dx = d === 0 ? -2 : d <= 3 ? -1 : d <= 5 ? 0 : d <= 8 ? 1 : 2;
                } else {
                    d = irand(10); dy = d > 2 ? -1 : 0;
                    dx = irand(3) - 1;
                }
            } else if (type === "shootLeft") {
                d = irand(10); dy = d <= 1 ? -1 : d <= 7 ? 0 : 1;
                d = irand(10); dx = d <= 1 ? -2 : d <= 5 ? -1 : d <= 8 ? 0 : 1;
            } else if (type === "shootRight") {
                d = irand(10); dy = d <= 1 ? -1 : d <= 7 ? 0 : 1;
                d = irand(10); dx = d <= 1 ? 2 : d <= 5 ? 1 : d <= 8 ? 0 : -1;
            } else if (type === "dying") {
                d = irand(10); dy = d <= 1 ? -1 : d <= 8 ? 0 : 1;
                d = irand(15);
                dx = d === 0 ? -3 : d <= 2 ? -2 : d <= 5 ? -1 : d <= 8 ? 0 : d <= 11 ? 1 : d <= 13 ? 2 : 3;
            } else { /* dead */
                d = irand(10); dy = d <= 2 ? -1 : d <= 6 ? 0 : 1;
                dx = irand(3) - 1;
            }
            return [dx, dy];
        }

        function chooseString(type, life, dx, dy) {
            var t = type;
            if (life < 4) t = "dying";
            switch (t) {
                case "trunk":
                    if (dy === 0) return { s: "/~", k: "wood" };
                    if (dx < 0) return { s: "\\|", k: "wood" };
                    if (dx === 0) return { s: "/|", k: "wood" };
                    return { s: "|\\", k: "wood" };
                case "shootLeft":
                    if (dy > 0) return { s: "\\", k: "wood" };
                    if (dy === 0) return { s: "\\_", k: "wood" };
                    if (dx < 0) return { s: "\\|", k: "wood" };
                    if (dx === 0) return { s: "/|", k: "wood" };
                    return { s: "/", k: "wood" };
                case "shootRight":
                    if (dy > 0) return { s: "/", k: "wood" };
                    if (dy === 0) return { s: "_/", k: "wood" };
                    if (dx < 0) return { s: "\\|", k: "wood" };
                    if (dx === 0) return { s: "/|", k: "wood" };
                    return { s: "/", k: "wood" };
                default: /* dying / dead -> leaves */
                    return { s: LEAVES[irand(LEAVES.length)], k: "leaf" };
            }
        }

        function branch(x, y, type, life) {
            var shootCooldown = MULT;
            while (life > 0 && steps.length < MAX_STEPS) {
                life--;
                var age = LIFESTART - life;
                var dd = setDeltas(type, life, age);
                var dx = dd[0], dy = dd[1];

                if (dy > 0 && y > potTopRow - 2) dy--; // don't grow into the pot

                if (life < 3) {
                    branch(x, y, "dead", life);
                } else if (type === "trunk" && life < MULT + 2) {
                    branch(x, y, "dying", life);
                } else if ((type === "shootLeft" || type === "shootRight") && life < MULT + 2) {
                    branch(x, y, "dying", life);
                } else if (type === "trunk" && (irand(3) === 0 || life % MULT === 0)) {
                    if (irand(8) === 0 && life > 7) {
                        shootCooldown = MULT * 2;
                        branch(x, y, "trunk", life + (irand(5) - 2));
                    } else if (shootCooldown <= 0) {
                        shootCooldown = MULT * 2;
                        shootCounter++;
                        branch(x, y, shootCounter % 2 === 1 ? "shootRight" : "shootLeft", life + MULT);
                    }
                }
                shootCooldown--;

                x += dx; y += dy;
                var cs = chooseString(type, life, dx, dy);
                steps.push({ x: Math.round(x), y: Math.round(y), s: cs.s, k: cs.k });
            }
        }

        var potStart = Math.floor((cols - POT[0].length) / 2);
        branch(potStart + 15, potTopRow - 1, "trunk", LIFESTART);
        return { steps: steps, potStart: potStart, potTopRow: potTopRow };
    }

    function esc(ch) {
        return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
    }

    /* ---- animated renderer -----------------------------------------
     * createGrower(preEl) owns a looping cbonsai animation inside a <pre>.
     * It manages its own timers; call start()/stop(). No shared state.
     * --------------------------------------------------------------- */
    function createGrower(preEl) {
        var timers = [], alive = false;

        function clearTimers() {
            timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
            timers = [];
        }

        function measure() {
            var probe = document.createElement("span");
            probe.style.visibility = "hidden";
            probe.style.whiteSpace = "pre";
            probe.textContent = Array(41).join("M");
            preEl.appendChild(probe);
            var w = probe.getBoundingClientRect().width / 40;
            probe.textContent = "M\nM";
            var h = probe.getBoundingClientRect().height / 2;
            preEl.removeChild(probe);
            return { w: w || 8, h: h || 15 };
        }

        function grow() {
            if (!alive) return;
            var cell = measure();
            var host = preEl.clientHeight || (preEl.parentNode && preEl.parentNode.clientHeight) || 300;
            var cols = Math.max(24, Math.floor(preEl.clientWidth / cell.w) - 1);
            var rows = Math.max(16, Math.floor(host / cell.h) - 1);

            var tree = generate(cols, rows);

            var chars = [], kinds = [];
            for (var r = 0; r < rows; r++) {
                chars.push(new Array(cols).fill(" "));
                kinds.push(new Array(cols).fill(null));
            }
            for (var i = 0; i < POT.length; i++) {
                var pr = tree.potTopRow + i;
                for (var c = 0; c < POT[i].length; c++) {
                    var pc = tree.potStart + c;
                    if (pr >= 0 && pr < rows && pc >= 0 && pc < cols && POT[i][c] !== " ") {
                        chars[pr][pc] = POT[i][c];
                        kinds[pr][pc] = "pot";
                    }
                }
            }

            function render() {
                var html = "";
                for (var r = 0; r < rows; r++) {
                    var line = "", run = "", runKind = "wood";
                    function flush() {
                        if (!run) return;
                        line += runKind === "wood" ? run : '<span class="' + runKind + '">' + run + "</span>";
                        run = "";
                    }
                    for (var c = 0; c < cols; c++) {
                        var ch = chars[r][c];
                        if (ch === " ") { flush(); line += " "; continue; }
                        var k = kinds[r][c] || "wood";
                        if (k !== runKind) { flush(); runKind = k; }
                        run += esc(ch);
                    }
                    flush();
                    html += line + "\n";
                }
                preEl.innerHTML = html;
            }
            render();

            var idx = 0, steps = tree.steps;
            var perTick = steps.length > 900 ? 3 : steps.length > 450 ? 2 : 1;
            var reveal = setInterval(function () {
                for (var n = 0; n < perTick && idx < steps.length; n++, idx++) {
                    var st = steps[idx];
                    for (var j = 0; j < st.s.length; j++) {
                        var x = st.x + j, y = st.y;
                        if (y >= 0 && y < rows && x >= 0 && x < cols) {
                            chars[y][x] = st.s[j];
                            kinds[y][x] = st.k;
                        }
                    }
                }
                render();
                if (idx >= steps.length) {
                    clearInterval(reveal);
                    var hold = setTimeout(function () { if (alive) grow(); }, 4500);
                    timers.push(hold);
                }
            }, 24);
            timers.push(reveal);
        }

        return {
            start: function () { if (alive) return; alive = true; var t = setTimeout(grow, 30); timers.push(t); },
            stop: function () { alive = false; clearTimers(); },
            el: preEl
        };
    }

    window.Cbonsai = { generate: generate, POT: POT, createGrower: createGrower };
})();
