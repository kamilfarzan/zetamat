import { getGameHistory, clearGameHistory, isStorageAvailable } from './app.js';

let currentFilter = {
    count: 20,
    config: 'all',
};

function formatDuration(sec) {
    return `${sec}s`;
}

function formatDate(isoStr) {
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (_) {
        return isoStr;
    }
}

export function initStats() {
    const container = document.getElementById('stats-app');
    if (!container) return;

    render(container);
}

function render(container) {
    const rawHistory = getGameHistory();
    const storageOk = isStorageAvailable();

    if (!rawHistory || rawHistory.length === 0) {
        container.innerHTML = `
            ${!storageOk ? '<p style="color: #666666; font-size: 13px;">Notice: Browser storage is disabled. Stats will not be saved across sessions.</p>' : ''}
            <h1>Statistics</h1>
            <p><a href="./index.html">← Back to game</a></p>
            <p style="margin: 24px 0;">No games played yet. <a href="./game.html">Start your first drill</a>.</p>
        `;
        return;
    }

    const configsMap = new Map();
    rawHistory.forEach(g => {
        if (!configsMap.has(g.configHash)) {
            configsMap.set(g.configHash, {
                hash: g.configHash,
                label: g.configLabel || 'Custom',
                count: 0,
            });
        }
        configsMap.get(g.configHash).count++;
    });

    let games = [...rawHistory];
    if (currentFilter.count !== 'all') {
        const n = parseInt(currentFilter.count, 10);
        games = games.slice(-n);
    }

    const activeConfig = currentFilter.config;
    if (activeConfig !== 'all') {
        games = games.filter(g => g.configHash === activeConfig);
    }

    const totalGames = games.length;
    const scores = games.map(g => g.score);
    const avgScore = totalGames ? (scores.reduce((a, b) => a + b, 0) / totalGames).toFixed(1) : 0;
    const bestScore = totalGames ? Math.max(...scores) : 0;

    let totalCorrect = 0;
    let totalTimeSec = 0;
    games.forEach(g => {
        totalCorrect += g.score;
        totalTimeSec += g.duration;
    });
    const avgPace = totalCorrect > 0 ? (totalTimeSec / totalCorrect).toFixed(2) + 's' : '—';

    container.innerHTML = `
        ${!storageOk ? '<p style="color: #666666; font-size: 13px; margin-bottom: 12px;">Notice: Browser storage is disabled. Stats will not be saved across sessions.</p>' : ''}
        <h1>Statistics</h1>
        <p style="margin-bottom: 18px;"><a href="./index.html">← Back to game</a></p>

        <p style="margin-bottom: 16px;">
            Duration:
            <select id="filter-count">
                <option value="10" ${currentFilter.count === 10 ? 'selected' : ''}>Last 10 games</option>
                <option value="20" ${currentFilter.count === 20 ? 'selected' : ''}>Last 20 games</option>
                <option value="all" ${currentFilter.count === 'all' ? 'selected' : ''}>All games (${rawHistory.length})</option>
            </select>
            &nbsp;&nbsp;
            Config:
            <select id="filter-config">
                <option value="all" ${activeConfig === 'all' ? 'selected' : ''}>All configs (${rawHistory.length})</option>
                ${Array.from(configsMap.values()).map(c => `
                    <option value="${c.hash}" ${activeConfig === c.hash ? 'selected' : ''}>
                        ${c.label} (${c.count})
                    </option>
                `).join('')}
            </select>
        </p>

        <dl>
            <dt>Games analyzed</dt>
            <dd>${totalGames}</dd>
            <dt>Average score</dt>
            <dd>${avgScore} (best: ${bestScore})</dd>
            <dt>Average pace</dt>
            <dd>${avgPace} per problem</dd>
        </dl>

        ${totalGames === 0 ? `
            <p style="margin: 20px 0;">No games match this configuration.</p>
        ` : `
            <h2>Speed by problem type</h2>
            <div class="chart-wrap">
                ${renderOpSpeedChart(games)}
            </div>

            <h2>Average intra-game pacing</h2>
            <div class="chart-wrap">
                ${renderIntraGamePacingChart(games)}
            </div>

            <h2>Score improvement trend</h2>
            <div class="chart-wrap">
                ${renderTrendChart(games)}
            </div>

            <h2>Recent games</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Config</th>
                        <th>Score</th>
                        <th>Duration</th>
                        <th>Pace</th>
                    </tr>
                </thead>
                <tbody>
                    ${games.slice().reverse().map(g => {
                        const pace = g.score > 0 ? (g.duration / g.score).toFixed(2) + 's' : '—';
                        return `
                            <tr>
                                <td>${formatDate(g.date)}</td>
                                <td>${g.configLabel || 'Custom'}</td>
                                <td><strong>${g.score}</strong></td>
                                <td>${formatDuration(g.duration)}</td>
                                <td>${pace}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <p style="margin-top: 24px; text-align: right;">
                <a href="#" id="clear-stats-btn">Clear all history</a>
            </p>
        `}
    `;

    attachEvents(container);
}

function attachEvents(container) {
    const countSelect = container.querySelector('#filter-count');
    if (countSelect) {
        countSelect.addEventListener('change', e => {
            currentFilter.count = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
            render(container);
        });
    }

    const configSelect = container.querySelector('#filter-config');
    if (configSelect) {
        configSelect.addEventListener('change', e => {
            currentFilter.config = e.target.value;
            render(container);
        });
    }

    const clearBtn = container.querySelector('#clear-stats-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', e => {
            e.preventDefault();
            if (window.confirm('Clear all game statistics?')) {
                clearGameHistory();
                currentFilter = { count: 20, config: 'all' };
                render(container);
            }
        });
    }
}

function renderOpSpeedChart(games) {
    const opStats = {
        add: { label: 'Addition', count: 0, totalTimeMs: 0 },
        sub: { label: 'Subtraction', count: 0, totalTimeMs: 0 },
        mul: { label: 'Multiplication', count: 0, totalTimeMs: 0 },
        div: { label: 'Division', count: 0, totalTimeMs: 0 },
    };

    games.forEach(g => {
        (g.problemLog || []).forEach(p => {
            if (p.timeMs > 0 && opStats[p.type]) {
                opStats[p.type].count++;
                opStats[p.type].totalTimeMs += p.timeMs;
            }
        });
    });

    const ops = Object.values(opStats).map(op => {
        const avgSec = op.count > 0 ? op.totalTimeMs / op.count / 1000 : 0;
        return { ...op, avgSec };
    }).filter(op => op.count > 0);

    if (ops.length === 0) {
        return '<p style="margin: 0; color: #666666; font-size: 13px;">No answered problems recorded.</p>';
    }

    const maxSec = Math.max(...ops.map(o => o.avgSec), 1);
    const W = 360;
    const barH = 12;
    const gap = 6;
    const padL = 90;
    const padR = 60;
    const H = ops.length * (barH + gap) + 4;
    const plotW = W - padL - padR;

    const barsSvg = ops.map((op, idx) => {
        const y = 2 + idx * (barH + gap);
        const w = (op.avgSec / maxSec) * plotW;
        return `
            <text x="${padL - 6}" y="${y + barH - 2}" font-size="10" text-anchor="end" fill="#000000">
                ${op.label}
            </text>
            <rect x="${padL}" y="${y}" width="${Math.max(2, w).toFixed(1)}" height="${barH}" fill="#0044cc" />
            <text x="${padL + w + 5}" y="${y + barH - 2}" font-size="10" fill="#000000">
                ${op.avgSec.toFixed(2)}s <tspan fill="#666666">(${op.count})</tspan>
            </text>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto">
            <line x1="${padL}" y1="0" x2="${padL}" y2="${H}" stroke="#cccccc" stroke-width="1" />
            ${barsSvg}
        </svg>
    `;
}

function renderIntraGamePacingChart(games) {
    const qMap = [];
    games.forEach(g => {
        (g.problemLog || []).filter(p => p.timeMs > 0).forEach((p, idx) => {
            if (!qMap[idx]) qMap[idx] = [];
            qMap[idx].push(p.timeMs / 1000);
        });
    });

    const pacing = [];
    for (let i = 0; i < qMap.length; i++) {
        if (qMap[i] && qMap[i].length > 0) {
            const sum = qMap[i].reduce((a, b) => a + b, 0);
            const avg = sum / qMap[i].length;
            pacing.push({ q: i + 1, avg, count: qMap[i].length });
        }
    }

    if (pacing.length < 2) {
        return '<p style="margin: 0; color: #666666; font-size: 13px;">Need more questions answered across games to plot pacing.</p>';
    }

    const times = pacing.map(p => p.avg);
    const maxT = Math.max(...times, 2);
    const minT = 0;

    const W = 360;
    const H = 75;
    const padL = 34;
    const padR = 10;
    const padT = 10;
    const padB = 20;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const points = pacing.map((p, idx) => {
        const x = padL + (idx / (pacing.length - 1)) * plotW;
        const normY = (p.avg - minT) / (maxT - minT || 1);
        const y = padT + (1 - normY) * plotH;
        return { x, y, avg: p.avg, q: p.q };
    });

    const polylinePts = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const dotsSvg = points.map(p => `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#0044cc">
            <title>Q${p.q}: ${p.avg.toFixed(2)}s avg</title>
        </circle>
    `).join('');

    return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto">
            <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#cccccc" stroke-width="1" />
            <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#cccccc" stroke-width="1" />

            <text x="${padL - 4}" y="${padT + 4}" font-size="9" text-anchor="end" fill="#666666">${maxT.toFixed(1)}s</text>
            <text x="${padL - 4}" y="${H - padB}" font-size="9" text-anchor="end" fill="#666666">0s</text>

            <text x="${padL}" y="${H - 6}" font-size="9" text-anchor="start" fill="#666666">Q1</text>
            <text x="${W - padR}" y="${H - 6}" font-size="9" text-anchor="end" fill="#666666">Q${pacing.length}</text>

            <polyline fill="none" stroke="#0044cc" stroke-width="1.2" points="${polylinePts}" />
            ${dotsSvg}
        </svg>
    `;
}

function renderTrendChart(games) {
    if (games.length < 2) {
        return '<p style="margin: 0; color: #666666; font-size: 13px;">Play at least 2 games to view improvement trend.</p>';
    }

    const scores = games.map(g => g.score);
    const maxScore = Math.max(...scores, 10);
    const minScore = 0;

    const W = 360;
    const H = 75;
    const padL = 34;
    const padR = 10;
    const padT = 10;
    const padB = 20;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const points = games.map((g, idx) => {
        const x = padL + (idx / (games.length - 1)) * plotW;
        const normY = (g.score - minScore) / (maxScore - minScore || 1);
        const y = padT + (1 - normY) * plotH;
        return { x, y, score: g.score, date: formatDate(g.date), idx: idx + 1 };
    });

    const polylinePts = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const dotsSvg = points.map(p => `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#0044cc">
            <title>Game ${p.idx} (${p.date}): Score ${p.score}</title>
        </circle>
    `).join('');

    return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto">
            <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#cccccc" stroke-width="1" />
            <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#cccccc" stroke-width="1" />

            <text x="${padL - 4}" y="${padT + 4}" font-size="9" text-anchor="end" fill="#666666">${maxScore}</text>
            <text x="${padL - 4}" y="${H - padB}" font-size="9" text-anchor="end" fill="#666666">0</text>

            <text x="${padL}" y="${H - 6}" font-size="9" text-anchor="start" fill="#666666">Game 1</text>
            <text x="${W - padR}" y="${H - 6}" font-size="9" text-anchor="end" fill="#666666">Game ${games.length}</text>

            <polyline fill="none" stroke="#0044cc" stroke-width="1.2" points="${polylinePts}" />
            ${dotsSvg}
        </svg>
    `;
}
