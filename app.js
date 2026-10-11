function rand(n) {
    return Math.floor(Math.random() * n);
}

export function parseOptions(customOptions = {}) {
    const params = new URLSearchParams(window.location.search);
    const hasParams = window.location.search && window.location.search.length > 1;

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

function saveGameLog(logEntry) {
    try {
        const historyJson = localStorage.getItem('zetamac_history');
        const history = historyJson ? JSON.parse(historyJson) : [];
        history.push(logEntry);
        if (history.length > 100) {
            history.shift();
        }
        localStorage.setItem('zetamac_history', JSON.stringify(history));
    } catch (e) {
        console.warn('Could not save game history to localStorage:', e);
    }
    console.log('[Zetamac] Game completed! Score:', logEntry.score, logEntry);
}

export function init(options = {}) {
    const opts = parseOptions(options);
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
            prettyProblem: left + ' + ' + right,
            plainProblem: left + ' + ' + right,
            answer: left + right,
        };
    }

    function pg_sub() {
        const first = randGens[genTypes[0]]();
        const second = randGens[genTypes[1]]();
        const left = first + second;
        const right = first;
        return {
            prettyProblem: left + ' \u2013 ' + right,
            plainProblem: left + ' - ' + right,
            answer: left - right,
        };
    }

    function pg_mul() {
        const left = randGens[genTypes[2]]();
        const right = randGens[genTypes[3]]();
        return {
            prettyProblem: left + ' \xD7 ' + right,
            plainProblem: left + ' * ' + right,
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
                prettyProblem: left + ' \xF7 ' + right,
                plainProblem: left + ' / ' + right,
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
            problem: genned.plainProblem,
            answer: genned.answer,
            entry: [],
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
            if (thisProblemLog && thisProblemLog.entry) {
                const lastEntry = thisProblemLog.entry[thisProblemLog.entry.length - 1] ?? '';
                if (
                    value.length - lastEntry.length > 1 || // paste
                    /[^-\d\s]/.test(value) || // non-numeric
                    lastEntry.length >= 2 + String(genned.answer).length // too long
                ) {
                    thisProblemLog.entry = null;
                } else {
                    thisProblemLog.entry.push(value);
                }
            }
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

            // Log locally to localStorage (works 100% serverless for GitHub Pages)
            const keyMatch = wls.match(/key=([0-9a-f]{8})/);
            const gameRecord = {
                key: keyMatch ? keyMatch[1] : null,
                score: correct_ct,
                duration: duration,
                date: new Date().toISOString(),
                problemLog: problemLog,
            };
            saveGameLog(gameRecord);

            // Transition to end screen
            if (startDiv) {
                startDiv.style.display = 'none';
            }
            if (endDiv) {
                endDiv.style.display = 'block';
            }

            // Optional non-blocking background POST if a backend endpoint exists
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
