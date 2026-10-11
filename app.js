function rand(n) {
    return Math.floor(Math.random() * n);
}

const STORAGE_KEY = 'zetamat_history';
let inMemoryHistory = [];

export function isStorageAvailable() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }
    try {
        const testKey = '__zetamat_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        return true;
    } catch (_) {
        return false;
    }
}

export function getGameHistory() {
    if (isStorageAvailable()) {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return inMemoryHistory;
        }
    }
    return inMemoryHistory;
}

export function saveGameHistory(record) {
    const history = getGameHistory();
    history.push(record);
    if (history.length > 100) {
        history.shift();
    }
    if (isStorageAvailable()) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
            inMemoryHistory = history;
        }
    } else {
        inMemoryHistory = history;
    }
    console.log('[Zetamat] Saved game record:', record);
}

export function clearGameHistory() {
    inMemoryHistory = [];
    if (isStorageAvailable()) {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
    }
}

export function getConfigInfo(opts) {
    const isDefault =
        opts.add &&
        opts.sub &&
        opts.mul &&
        opts.div &&
        opts.duration === 120 &&
        opts.add_left_min === 2 &&
        opts.add_left_max === 100 &&
        opts.add_right_min === 2 &&
        opts.add_right_max === 100 &&
        opts.mul_left_min === 2 &&
        opts.mul_left_max === 12 &&
        opts.mul_right_min === 2 &&
        opts.mul_right_max === 100;

    const ops = [];
    if (opts.add) ops.push('+');
    if (opts.sub) ops.push('−');
    if (opts.mul) ops.push('×');
    if (opts.div) ops.push('÷');

    const opsStr = ops.length === 4 ? 'All' : ops.join(' ');
    const hash = isDefault
        ? 'default_120'
        : `${ops.join('')}_${opts.duration}_${opts.add_left_min}-${opts.add_left_max}_${opts.add_right_min}-${opts.add_right_max}_${opts.mul_left_min}-${opts.mul_left_max}_${opts.mul_right_min}-${opts.mul_right_max}`;

    const label = isDefault
        ? 'Default (120s)'
        : `${opsStr} (${opts.duration}s)`;

    return { hash, label, isDefault };
}

export function parseOptions(customOptions = {}) {
    const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const params = new URLSearchParams(search);
    const hasParams = search && search.length > 1;

    const defaults = {
        add: true,
        sub: true,
        mul: true,
        div: true,
        duration: 120,
        add_left_min: 2,
        add_left_max: 100,
        add_right_min: 2,
        add_right_max: 100,
        mul_left_min: 2,
        mul_left_max: 12,
        mul_right_min: 2,
        mul_right_max: 100,
    };

    if (hasParams) {
        const parsed = {
            add: params.has('add'),
            sub: params.has('sub'),
            mul: params.has('mul'),
            div: params.has('div'),
            duration: parseInt(params.get('duration') ?? '120', 10) || 120,
            add_left_min: parseInt(params.get('add_left_min') ?? '2', 10),
            add_left_max: parseInt(params.get('add_left_max') ?? '100', 10),
            add_right_min: parseInt(params.get('add_right_min') ?? '2', 10),
            add_right_max: parseInt(params.get('add_right_max') ?? '100', 10),
            mul_left_min: parseInt(params.get('mul_left_min') ?? '2', 10),
            mul_left_max: parseInt(params.get('mul_left_max') ?? '12', 10),
            mul_right_min: parseInt(params.get('mul_right_min') ?? '2', 10),
            mul_right_max: parseInt(params.get('mul_right_max') ?? '100', 10),
        };
        // If all operations were unchecked in query params, fall back to addition
        if (!parsed.add && !parsed.sub && !parsed.mul && !parsed.div) {
            parsed.add = true;
        }
        return { ...defaults, ...parsed, ...customOptions };
    }

    return { ...defaults, ...customOptions };
}

/**
 * Generates responsive inline SVG for intra-game pacing (Question vs Time in seconds).
 * Designed for mobile portrait with viewBox and 100% width.
 */
export function renderPacingChart(completedProblems) {
    if (!completedProblems || completedProblems.length < 2) {
        return '<p class="pacing-empty">Need at least 2 answered questions to plot pacing.</p>';
    }

    const timesSec = completedProblems.map(p => Math.max(0.05, p.timeMs / 1000));
    const maxTime = Math.max(...timesSec, 2);
    const minTime = Math.min(...timesSec, 0);

    const W = 360;
    const H = 75;
    const padL = 34;
    const padR = 10;
    const padT = 10;
    const padB = 20;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const points = timesSec.map((t, idx) => {
        const x = padL + (idx / (timesSec.length - 1)) * plotW;
        const normY = (t - minTime) / (maxTime - minTime || 1);
        const y = padT + (1 - normY) * plotH;
        return { x, y, t, q: idx + 1 };
    });

    const polylinePts = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const dotsSvg = points.map(p => `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#0044cc">
            <title>Q${p.q}: ${p.t.toFixed(2)}s</title>
        </circle>
    `).join('');

    return `
    <div style="max-width: 360px; margin: 12px auto; font-size: 13px; text-align: left;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #666666;">Pacing (seconds / problem):</p>
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="display: block;">
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#cccccc" stroke-width="1" />
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#cccccc" stroke-width="1" />
        
        <text x="${padL - 4}" y="${padT + 4}" font-size="9" text-anchor="end" fill="#666666">${maxTime.toFixed(1)}s</text>
        <text x="${padL - 4}" y="${H - padB}" font-size="9" text-anchor="end" fill="#666666">0s</text>
        
        <text x="${padL}" y="${H - 6}" font-size="9" text-anchor="start" fill="#666666">Q1</text>
        <text x="${W - padR}" y="${H - 6}" font-size="9" text-anchor="end" fill="#666666">Q${timesSec.length}</text>
        
        <polyline fill="none" stroke="#0044cc" stroke-width="1.2" points="${polylinePts}" />
        ${dotsSvg}
      </svg>
    </div>
    `;
}

export function init(options = {}) {
    const opts = parseOptions(options);
    const configInfo = getConfigInfo(opts);
    let problemStartTime;

    const game = document.getElementById('game');
    if (!game) return;

    const d_left = game.querySelector('.left');
    const correctElements = game.querySelectorAll('.correct');
    const banner = game.querySelector('.banner');
    const problem = game.querySelector('.problem');
    const answer = game.querySelector('.answer');
    const startDiv = banner?.querySelector('.start');
    const endDiv = banner?.querySelector('.end');
    const tryAgainLink = banner?.querySelector('.try-again-link');
    const pacingContainer = banner?.querySelector('.pacing-chart');

    if (tryAgainLink) {
        tryAgainLink.href = './game.html' + (window.location.search || '');
    }

    if (answer) {
        answer.focus();
    }

    const wls = window.location.search;

    function randGen(min, max) {
        return function () {
            return min + rand(max - min + 1);
        };
    }

    const genTypes = ['add_left', 'add_right', 'mul_left', 'mul_right'];
    const randGens = {};
    genTypes.forEach(function (type) {
        randGens[type] = randGen(opts[`${type}_min`], opts[`${type}_max`]);
    });

    function pg_add() {
        const left = randGens[genTypes[0]]();
        const right = randGens[genTypes[1]]();
        return {
            type: 'add',
            prettyProblem: left + ' + ' + right,
            answer: left + right,
        };
    }

    function pg_sub() {
        const first = randGens[genTypes[0]]();
        const second = randGens[genTypes[1]]();
        const left = first + second;
        const right = first;
        return {
            type: 'sub',
            prettyProblem: left + ' \u2013 ' + right,
            answer: left - right,
        };
    }

    function pg_mul() {
        const left = randGens[genTypes[2]]();
        const right = randGens[genTypes[3]]();
        return {
            type: 'mul',
            prettyProblem: left + ' \xD7 ' + right,
            answer: left * right,
        };
    }

    function pg_div() {
        const first = randGens[genTypes[2]]();
        const second = randGens[genTypes[3]]();
        if (first !== 0) {
            const left = first * second;
            const right = first;
            return {
                type: 'div',
                prettyProblem: left + ' \xF7 ' + right,
                answer: left / right,
            };
        }
    }

    const pgs = [];
    if (opts.add) pgs.push(pg_add);
    if (opts.sub) pgs.push(pg_sub);
    if (opts.mul) pgs.push(pg_mul);
    if (opts.div) pgs.push(pg_div);

    function problemGen() {
        let genned;
        while (genned == null) {
            genned = pgs[rand(pgs.length)]();
        }
        return genned;
    }

    let genned;
    let thisProblemLog;

    function problemGeng() {
        genned = problemGen();
        thisProblemLog = {
            type: genned.type,
            problem: genned.prettyProblem,
            answer: genned.answer,
            timeMs: -1,
        };
        if (problem) {
            problem.textContent = genned.prettyProblem;
        }
        if (answer) {
            answer.value = '';
        }
    }

    function updateScore(score) {
        correctElements.forEach(function (el) {
            el.textContent = 'Score: ' + score;
        });
    }

    const startTime = (problemStartTime = Date.now());
    let correct_ct = 0;
    const problemLog = [];

    if (answer) {
        answer.addEventListener('input', function (e) {
            const value = e.currentTarget.value;
            if (value.trim() === String(genned.answer)) {
                const now = Date.now();
                thisProblemLog.timeMs = now - problemStartTime;
                problemLog.push(thisProblemLog);
                problemStartTime = now;
                problemGeng();
                correct_ct++;
                updateScore(correct_ct);
            }
            return true;
        });
    }

    problemGeng();

    const duration = opts.duration || 120;
    if (d_left) {
        d_left.textContent = 'Seconds left: ' + duration;
    }

    const timer = setInterval(function () {
        const d = duration - Math.floor((Date.now() - startTime) / 1000);
        if (d_left) {
            d_left.textContent = 'Seconds left: ' + Math.max(0, d);
        }

        if (d <= 0) {
            clearInterval(timer);
            if (thisProblemLog) {
                problemLog.push(thisProblemLog);
            }
            if (answer) {
                answer.disabled = true;
            }

            const bsEat = function (e) {
                if (e.key === 'Backspace' || e.keyCode === 8) {
                    e.preventDefault();
                    return false;
                }
                return true;
            };
            document.addEventListener('keydown', bsEat);

            setTimeout(function () {
                document.removeEventListener('keydown', bsEat);
            }, 1000);

            // Completed problems have valid timeMs
            const completedProblems = problemLog.filter(p => p.timeMs > 0);

            // Log locally to zetamat_history (100% serverless)
            const keyMatch = wls.match(/key=([0-9a-f]{8})/);
            const gameRecord = {
                id: 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                key: keyMatch ? keyMatch[1] : null,
                score: correct_ct,
                duration: duration,
                date: new Date().toISOString(),
                configHash: configInfo.hash,
                configLabel: configInfo.label,
                options: opts,
                problemLog: problemLog,
            };
            saveGameHistory(gameRecord);

            // Render post-game intra-game pacing SVG chart
            if (pacingContainer) {
                pacingContainer.innerHTML = renderPacingChart(completedProblems);
            }

            // Transition to end screen
            if (startDiv) {
                startDiv.style.display = 'none';
            }
            if (endDiv) {
                endDiv.style.display = 'block';
            }

            // Optional non-blocking background POST
            try {
                fetch('/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: gameRecord.key,
                        score: correct_ct,
                        problemLog: JSON.stringify(problemLog),
                    }),
                }).catch(function () {});
            } catch (_) {}
        }
    }, 1000);

    if (wls.match(/\bpink\b/) && banner) {
        banner.style.backgroundColor = 'pink';
    }
}
