/* ============================================================================
   RELATÓRIO DE OCORRÊNCIAS MENSAIS & GESTÃO DE OCORRÊNCIAS OPERACIONAIS
   Escala Imerys • Britagem ICP 1 (iOS Safari/PWA, Android Chrome e PC 60-144Hz)
   ============================================================================ */
(function () {
    if (window.__IMERYS_SUPERVISOR_LOADED__) return;
    window.__IMERYS_SUPERVISOR_LOADED__ = true;

    const META_STORAGE_KEY = 'imerys_override_meta';
    if (typeof STORAGE_KEYS !== 'undefined' && Array.isArray(STORAGE_KEYS) && !STORAGE_KEYS.includes(META_STORAGE_KEY)) {
        STORAGE_KEYS.push(META_STORAGE_KEY);
    }

    const REQUIRED_GLOBALS = [
        'DB', 'SHIFTS_CONFIG', 'TEAM_LETTERS', 'DEFAULT_TEAM_DESC', 'DOW_NAMES',
        'DOW_PRETTY', 'MONTH_SHORT', 'IMERYS_SVG_URI', 'getShift', 'getHolidays',
        'parseDateKey', 'formatDateKey', 'formatShortDate', 'formatReturnDateLabel',
        'getAtestadoDates', 'findAtestadoOnDate', 'computeReturnInfo', 'getAtestadoReason',
        'setNote', 'sanitizeTeamList', 'safeParseJSON', 'escapeHTML', 'showToast',
        'haptic', 'openAnimatedModal', 'closeModal', 'closeInfoModal', 'closeExportModal',
        'markModalDirty', 'updateStorageHealthUI', 'updateCountAnimated', 'animateTableSwap',
        'scrollToTodayColumn', 'updateTableScrollHint', 'loadLogoImage', 'canvasRoundRect',
        'canvasTruncateText', 'formatICSAllDay', 'formatICSDate', 'sanitizeICS'
    ];

    function checkHostDependencies() {
        const missing = REQUIRED_GLOBALS.filter(name => typeof window[name] === 'undefined');
        if (missing.length) {
            console.warn('[Escala Imerys] Dependências ausentes no host:', missing.join(', '));
        }
        return missing.length === 0;
    }

    let exportMode = 'quadro';     // 'quadro' | 'supervisor'
    let supTeamFilter = 'all';     // 'all' | '0' | '1' | '2' | '3'
    let supCategoryFilter = 'all'; // 'all' | 'he' | 'at' | 'fa' | 'td' | 'ea_sa' | 'dm_ep' | 'other'
    let supSortMode = 'date';      // 'date' | 'team'

    let overrideMetaDb = {};
    let modalAtestadoWho = 'both'; // '0' | '1' | 'both'
    let modalOverrideWho = 'both'; // '0' | '1' | 'both'
    let modalSwapWith = '';
    let modalSwapWithTeam = '';
    let modalCoveredBy = '';
    let modalEntryTime = '';
    let modalExitTime = '';
    let modalArrivalTime = '';

    let lastRenderedTurma = null;
    let lastRenderedMonthKey = '';

    if (typeof SHIFTS_CONFIG === 'object' && SHIFTS_CONFIG) {
        SHIFTS_CONFIG.FA = {
            name: 'Falta',
            hours: '',
            style: 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 font-black ring-2 ring-inset ring-red-500/80 dark:ring-red-500/70'
        };
    }

    const OCC_META = {
        HE50: {
            code: '50%', chip: '50%', label: 'Hora Extra 50%', short: 'HE 50%',
            palette: 'HE', ring: 'ring-2 ring-inset ring-amber-400 dark:ring-amber-500', dot: 'bg-amber-500',
            pillCls: 'sup-pill-he', cardCls: 'occ-card-he', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['entry', 'exit'], countKey: 'he', filterGroup: 'he'
        },
        HE75: {
            code: '75%', chip: '75%', label: 'Hora Extra 75%', short: 'HE 75%',
            palette: 'HE', ring: 'ring-2 ring-inset ring-amber-400 dark:ring-amber-500', dot: 'bg-amber-500',
            pillCls: 'sup-pill-he', cardCls: 'occ-card-he', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['entry', 'exit'], countKey: 'he', filterGroup: 'he'
        },
        HE110: {
            code: '110%', chip: '110%', label: 'Hora Extra 110%', short: 'HE 110%',
            palette: 'HE', ring: 'ring-2 ring-inset ring-amber-600 dark:ring-amber-400', dot: 'bg-amber-600',
            pillCls: 'sup-pill-he', cardCls: 'occ-card-he', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['entry', 'exit'], countKey: 'he', filterGroup: 'he'
        },
        TD: {
            code: 'TD', chip: 'TD', label: 'Troca de Dia', short: 'Troca',
            palette: 'TD', ring: 'ring-2 ring-inset ring-purple-500 dark:ring-purple-400', dot: 'bg-purple-500',
            pillCls: 'sup-pill-td', cardCls: 'occ-card-td', hasWho: true, isSwap: true, canCover: true,
            timeFields: [], countKey: 'td', filterGroup: 'td'
        },
        F: {
            code: 'F', chip: 'F', label: 'Folga', short: 'Folga',
            palette: 'F', ring: 'ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400', dot: 'bg-emerald-500',
            pillCls: 'sup-pill-f', cardCls: 'occ-card-f', hasWho: false, isSwap: false, canCover: false,
            timeFields: [], countKey: 'other', filterGroup: 'other'
        },
        FA: {
            code: 'FA', chip: 'FA', label: 'Falta', short: 'Falta',
            palette: 'FA', ring: 'ring-2 ring-inset ring-red-600 dark:ring-red-400', dot: 'bg-red-600',
            pillCls: 'sup-pill-fa', cardCls: 'occ-card-fa', hasWho: true, isSwap: false, canCover: true,
            timeFields: [], countKey: 'fa', filterGroup: 'fa'
        },
        EA: {
            code: 'EA', chip: 'EA', label: 'Entrada Atrasada', short: 'Ent. Atr.',
            palette: 'EA', ring: 'ring-2 ring-inset ring-cyan-500 dark:ring-cyan-400', dot: 'bg-cyan-500',
            pillCls: 'sup-pill-ea', cardCls: 'occ-card-ea', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['entry'], countKey: 'ea', filterGroup: 'ea_sa'
        },
        SA: {
            code: 'SA', chip: 'SA', label: 'Saída Adiantada', short: 'Saí. Adi.',
            palette: 'SA', ring: 'ring-2 ring-inset ring-teal-500 dark:ring-teal-400', dot: 'bg-teal-500',
            pillCls: 'sup-pill-sa', cardCls: 'occ-card-sa', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['exit'], countKey: 'sa', filterGroup: 'ea_sa'
        },
        DM: {
            code: 'DM', chip: 'DM', label: 'Declaração Médica', short: 'Decl. Méd.',
            palette: 'DM', ring: 'ring-2 ring-inset ring-indigo-500 dark:ring-indigo-400', dot: 'bg-indigo-500',
            pillCls: 'sup-pill-dm', cardCls: 'occ-card-dm', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['exit', 'entry'], countKey: 'dm', filterGroup: 'dm_ep'
        },
        EP: {
            code: 'EP', chip: 'EP', label: 'Exame Periódico', short: 'Ex. Periód.',
            palette: 'EP', ring: 'ring-2 ring-inset ring-sky-500 dark:ring-sky-400', dot: 'bg-sky-500',
            pillCls: 'sup-pill-ep', cardCls: 'occ-card-ep', hasWho: true, isSwap: false, canCover: false,
            timeFields: ['arrival'], countKey: 'ep', filterGroup: 'dm_ep'
        }
    };

    const VALID_OVERRIDES = ['HE50', 'HE75', 'HE110', 'TD', 'F', 'FA', 'EA', 'SA', 'DM', 'EP', 'M', 'T', 'N'];

    const PALETTE = {
        M:  { bg: '#dbeafe', fg: '#1e40af' },
        T:  { bg: '#ffedd5', fg: '#9a3412' },
        N:  { bg: '#e0e7ff', fg: '#3730a3' },
        F:  { bg: '#dcfce7', fg: '#15803d' },
        AT: { bg: '#ffe4e6', fg: '#be123c' },
        FA: { bg: '#fee2e2', fg: '#b91c1c' },
        HE: { bg: '#fef3c7', fg: '#92400e' },
        TD: { bg: '#f3e8ff', fg: '#6b21a8' },
        EA: { bg: '#cffafe', fg: '#0e7490' },
        SA: { bg: '#ccfbf1', fg: '#0f766e' },
        DM: { bg: '#e0e7ff', fg: '#3730a3' },
        EP: { bg: '#e0f2fe', fg: '#0369a1' }
    };

    /* 1. SANITIZAÇÃO E PERSISTÊNCIA (localStorage + IndexedDB) */
    function sanitizeTimeStr(raw) {
        if (typeof raw !== 'string') return '';
        const clean = raw.trim();
        const m = clean.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (!m) return '';
        return `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}`;
    }

    function timeToMinutes(hhmm) {
        const clean = sanitizeTimeStr(hhmm);
        if (!clean) return null;
        const [h, m] = clean.split(':').map(n => parseInt(n, 10));
        return h * 60 + m;
    }

    function formatDurationBetween(startHHMM, endHHMM) {
        const sMin = timeToMinutes(startHHMM);
        const eMin = timeToMinutes(endHHMM);
        if (sMin === null || eMin === null) return '';
        let diff = eMin - sMin;
        if (diff <= 0) diff += 1440;
        if (diff <= 0 || diff >= 1440) return '';
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hrs > 0 && mins > 0) return `${hrs}h${String(mins).padStart(2, '0')}`;
        if (hrs > 0) return `${hrs}h`;
        return `${mins}min`;
    }

    function normalizeMetaRecord(raw) {
        const v = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        const wt = ['0', '1', 'both'].includes(String(v.whoType)) ? String(v.whoType) : 'both';
        const swapWith = typeof v.swapWith === 'string' ? v.swapWith.trim().slice(0, 40) : '';
        return {
            whoType: wt,
            whoName: typeof v.whoName === 'string' ? v.whoName.trim().slice(0, 40) : '',
            swapWith,
            swapWithTeam: swapWith && typeof v.swapWithTeam === 'string' ? v.swapWithTeam.trim().slice(0, 2) : '',
            coveredBy: typeof v.coveredBy === 'string' ? v.coveredBy.trim().slice(0, 40) : '',
            entryTime: sanitizeTimeStr(v.entryTime),
            exitTime: sanitizeTimeStr(v.exitTime),
            arrivalTime: sanitizeTimeStr(v.arrivalTime)
        };
    }

    function sanitizeAllState() {
        const tNum = parseInt(currentTurma, 10);
        currentTurma = (!isNaN(tNum) && tNum >= 0 && tNum <= 3) ? tNum : 2;
        teamNames = sanitizeTeamList(teamNames);

        if (!notesDb || typeof notesDb !== 'object' || Array.isArray(notesDb)) notesDb = {};
        if (!overridesDb || typeof overridesDb !== 'object' || Array.isArray(overridesDb)) overridesDb = {};
        if (!overrideMetaDb || typeof overrideMetaDb !== 'object' || Array.isArray(overrideMetaDb)) overrideMetaDb = {};
        if (!Array.isArray(atestadosDb)) atestadosDb = [];

        const cleanNotes = {};
        Object.entries(notesDb).forEach(([k, v]) => {
            if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && typeof v === 'string') {
                const txt = v.trim();
                if (txt) cleanNotes[k] = txt;
            }
        });
        notesDb = cleanNotes;

        const cleanOv = {};
        Object.entries(overridesDb).forEach(([k, v]) => {
            if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && VALID_OVERRIDES.includes(v)) {
                cleanOv[k] = v;
            }
        });
        overridesDb = cleanOv;

        const cleanMeta = {};
        Object.entries(overrideMetaDb).forEach(([k, v]) => {
            if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && cleanOv[k] && v && typeof v === 'object' && !Array.isArray(v)) {
                cleanMeta[k] = normalizeMetaRecord(v);
            }
        });
        overrideMetaDb = cleanMeta;

        atestadosDb = atestadosDb.filter(r =>
            r && typeof r === 'object' &&
            /^\d{4}-\d{2}-\d{2}$/.test(String(r.startDate || '')) &&
            Number.isInteger(Number(r.turma)) && Number(r.turma) >= 0 && Number(r.turma) <= 3 &&
            (parseInt(r.days, 10) || 0) >= 1
        ).map(r => ({
            id: String(r.id || `at_${r.startDate}_${r.turma}`),
            turma: Number(r.turma),
            startDate: String(r.startDate),
            days: Math.max(1, Math.min(180, parseInt(r.days, 10) || 1)),
            whoType: ['0', '1', 'both'].includes(String(r.whoType)) ? String(r.whoType) : 'both',
            whoName: typeof r.whoName === 'string' ? r.whoName.trim().slice(0, 40) : ''
        }));
    }

    const origHydrate = window.hydrateStateFromDB;
    window.hydrateStateFromDB = function () {
        if (typeof origHydrate === 'function') origHydrate();
        overrideMetaDb = safeParseJSON(DB.get(META_STORAGE_KEY), {}, 'object');
        sanitizeAllState();
    };
    window.hydrateStateFromDB();

    DB.flushAll = function () {
        sanitizeAllState();
        return [
            this.set('imerys_turma', currentTurma),
            this.set('imerys_notes', JSON.stringify(notesDb)),
            this.set('imerys_overrides', JSON.stringify(overridesDb)),
            this.set('imerys_atestados', JSON.stringify(atestadosDb)),
            this.set('imerys_teams', JSON.stringify(teamNames)),
            this.set(META_STORAGE_KEY, JSON.stringify(overrideMetaDb))
        ].every(Boolean);
    };

    window.getNote = function (dateKey, turmaIdx) {
        const val = notesDb[`${dateKey}_${turmaIdx}`];
        return typeof val === 'string' ? val : '';
    };

    window.getEffectiveShift = function (dateKey, turmaIdx) {
        const ov = overridesDb[`${dateKey}_${turmaIdx}`];
        if (ov === 'F' || ov === 'M' || ov === 'T' || ov === 'N') return ov;
        const dt = parseDateKey(dateKey);
        return getShift(dt.getFullYear(), dt.getMonth(), dt.getDate(), turmaIdx);
    };

    /* 2. HELPERS DE EQUIPE, TRABALHADORES, HORÁRIOS E TROCAS */
    function parseTeamMembers(teamStr) {
        const clean = String(teamStr || '').trim();
        if (!clean) return [];
        const parts = clean
            .split(/\s+(?:e|&)\s+|\s*[,\/+&]\s*/i)
            .map(s => s.trim())
            .filter(Boolean);
        return parts.length ? parts.slice(0, 2) : [clean];
    }

    function shortMemberName(name) {
        const first = String(name || '').trim().split(/\s+/)[0] || '';
        return first.length > 8 ? first.slice(0, 7) + '…' : first;
    }

    function resolveWhoInfo(rec, fallbackTurma) {
        const turmaIdx = (rec && typeof rec.turma === 'number') ? rec.turma : fallbackTurma;
        const teamStr = teamNames[turmaIdx] || DEFAULT_TEAM_DESC[turmaIdx] || '';
        const members = parseTeamMembers(teamStr);
        const whoType = rec && rec.whoType ? String(rec.whoType) : 'both';

        if (whoType === 'both' || members.length < 2) {
            if (members.length === 1) {
                return {
                    whoType: '0', whoName: members[0], label: members[0],
                    fullLabel: members[0], shortLabel: shortMemberName(members[0])
                };
            }
            return {
                whoType: 'both', whoName: '', label: 'Os dois',
                fullLabel: `Os dois (${teamStr})`, shortLabel: 'Os dois'
            };
        }

        const idx = whoType === '1' ? 1 : 0;
        const resolvedName = (rec && rec.whoName) ? rec.whoName : (members[idx] || teamStr);
        return {
            whoType: String(idx), whoName: resolvedName, label: resolvedName,
            fullLabel: resolvedName, shortLabel: shortMemberName(resolvedName)
        };
    }

    function getSelectionWhoInfo(whoState, turmaIdx) {
        const teamStr = teamNames[turmaIdx] || DEFAULT_TEAM_DESC[turmaIdx] || '';
        const members = parseTeamMembers(teamStr);
        if (members.length < 2) {
            const single = members[0] || teamStr;
            return { whoType: '0', whoName: single, label: single, fullLabel: single, shortLabel: shortMemberName(single) };
        }
        if (whoState === '0' || whoState === '1') {
            const name = members[parseInt(whoState, 10)] || members[0];
            return { whoType: whoState, whoName: name, label: name, fullLabel: name, shortLabel: shortMemberName(name) };
        }
        return {
            whoType: 'both', whoName: '', label: 'Os dois',
            fullLabel: `Os dois (${teamStr})`, shortLabel: 'Os dois'
        };
    }

    function getOverrideMeta(dateKey, turmaIdx) {
        const raw = overrideMetaDb[`${dateKey}_${turmaIdx}`];
        return (raw && typeof raw === 'object') ? raw : null;
    }

    function formatSwapDisplay(meta, turmaIdx) {
        const who = resolveWhoInfo(meta ? { ...meta, turma: turmaIdx } : { turma: turmaIdx, whoType: 'both' }, turmaIdx);
        const target = meta && meta.swapWith ? String(meta.swapWith).trim() : '';
        const targetTeam = meta && meta.swapWithTeam ? String(meta.swapWithTeam).trim() : '';
        const targetFull = target ? (targetTeam ? `${target} (T.${targetTeam})` : target) : '';
        const targetShort = target ? shortMemberName(target) : '';
        const compactLabel = targetShort ? `⇄ ${targetShort}` : 'Troca';
        const pairLabel = targetFull ? `${who.label} ⇄ ${targetFull}` : who.label;
        return { who, target, targetTeam, targetFull, targetShort, compactLabel, pairLabel };
    }

    function buildOccurrenceDetailSummary(code, meta, baseCfg) {
        const m = OCC_META[code];
        const fields = (m && Array.isArray(m.timeFields)) ? m.timeFields : [];
        const entry = sanitizeTimeStr(meta && meta.entryTime);
        const exit = sanitizeTimeStr(meta && meta.exitTime);
        const arrival = sanitizeTimeStr(meta && meta.arrivalTime);
        const coveredBy = meta && meta.coveredBy ? String(meta.coveredBy).trim() : '';

        const timeParts = [];
        let compact = '';
        let warning = '';

        if (code === 'EA') {
            if (entry) { timeParts.push(`Entrada às ${entry}`); compact = entry; }
        } else if (code === 'SA') {
            if (exit) { timeParts.push(`Saída às ${exit}`); compact = exit; }
        } else if (code === 'EP') {
            if (arrival) { timeParts.push(`Chegou às ${arrival}`); compact = arrival; }
        } else if (code === 'DM') {
            if (exit) timeParts.push(`Saiu às ${exit}`);
            if (entry) timeParts.push(`Entrou às ${entry}`);
            const dur = formatDurationBetween(exit, entry);
            if (dur) timeParts.push(`Duração: ${dur}`);
            compact = (exit && entry) ? `${exit}-${entry}` : (exit || entry || '');
            if (exit && entry && timeToMinutes(exit) === timeToMinutes(entry)) {
                warning = 'Horário de saída e entrada são iguais.';
            }
        } else if (fields.includes('entry') && fields.includes('exit')) {
            if (entry) timeParts.push(`Entrou às ${entry}`);
            if (exit) timeParts.push(`Saiu às ${exit}`);
            const dur = formatDurationBetween(entry, exit);
            if (dur) timeParts.push(`Total: ${dur}`);
            compact = (entry && exit) ? `${entry}-${exit}` : (entry || exit || '');
            if (entry && exit && timeToMinutes(entry) === timeToMinutes(exit)) {
                warning = 'Horário de entrada e saída são iguais.';
            }
        }

        const extraParts = [...timeParts];
        if (coveredBy) extraParts.push(`Cobertura: ${coveredBy}`);

        const baseInfo = `Escala: ${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''}`;
        const summary = extraParts.length ? `${extraParts.join(' • ')} • ${baseInfo}` : baseInfo;

        return {
            entry, exit, arrival, coveredBy, compact,
            timeSummary: timeParts.join(' • '),
            extraSummary: extraParts.join(' • '),
            summary,
            warning
        };
    }

    function isExtraOverride(ov) {
        return ov === 'HE50' || ov === 'HE75' || ov === 'HE110' || ov === 'M' || ov === 'T' || ov === 'N';
    }

    /* 3. ESTILOS VISUAIS COMPLEMENTARES */
    function injectModuleStyles() {
        if (document.getElementById('supervisor-report-styles')) return;
        const style = document.createElement('style');
        style.id = 'supervisor-report-styles';
        style.textContent = `
            .a4-cell-FA { background: #fee2e2; color: #b91c1c; box-shadow: inset 0 0 0 2px #dc2626; }
            .a4-cell-HE { background: #fef3c7; color: #92400e; }
            .a4-cell-TD { background: #f3e8ff; color: #6b21a8; }
            .a4-cell-EA { background: #cffafe; color: #0e7490; }
            .a4-cell-SA { background: #ccfbf1; color: #0f766e; }
            .a4-cell-DM { background: #e0e7ff; color: #3730a3; box-shadow: inset 0 0 0 2px #6366f1; }
            .a4-cell-EP { background: #e0f2fe; color: #0369a1; box-shadow: inset 0 0 0 2px #0ea5e9; }
            .a4-cell-td { box-shadow: inset 0 0 0 2.5px #7c3aed; }
            .a4-cell-ea { box-shadow: inset 0 0 0 2.5px #06b6d4; }
            .a4-cell-sa { box-shadow: inset 0 0 0 2.5px #14b8a6; }
            .a4-cell-who {
                display: block;
                font-size: 6.5px;
                font-weight: 800;
                line-height: 1;
                margin-top: 1px;
                max-width: 32px;
                margin-left: auto;
                margin-right: auto;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Identificação visual correspondente em cada cartão de ocorrência */
            .occ-card {
                border-radius: 1rem;
                padding: 0.75rem;
                border-width: 1px;
                border-left-width: 4px;
                background: #ffffff;
                border-color: #e2e8f0;
                border-left-color: #64748b;
            }
            .occ-card-at   { border-left-color: #f43f5e; background: rgba(255, 241, 242, 0.75); border-color: #fecdd3; border-left-width: 4px; }
            .occ-card-fa   { border-left-color: #ef4444; background: rgba(254, 242, 242, 0.75); border-color: #fecaca; border-left-width: 4px; }
            .occ-card-he   { border-left-color: #f59e0b; background: rgba(255, 251, 235, 0.75); border-color: #fde68a; border-left-width: 4px; }
            .occ-card-td   { border-left-color: #a855f7; background: rgba(250, 245, 255, 0.75); border-color: #e9d5ff; border-left-width: 4px; }
            .occ-card-f    { border-left-color: #22c55e; background: rgba(240, 253, 244, 0.75); border-color: #bbf7d0; border-left-width: 4px; }
            .occ-card-ea   { border-left-color: #06b6d4; background: rgba(236, 254, 255, 0.75); border-color: #a5f3fc; border-left-width: 4px; }
            .occ-card-sa   { border-left-color: #14b8a6; background: rgba(240, 253, 250, 0.75); border-color: #99f6e4; border-left-width: 4px; }
            .occ-card-dm   { border-left-color: #6366f1; background: rgba(238, 242, 255, 0.75); border-color: #c7d2fe; border-left-width: 4px; }
            .occ-card-ep   { border-left-color: #0ea5e9; background: rgba(240, 249, 255, 0.75); border-color: #bae6fd; border-left-width: 4px; }
            .occ-card-note { border-left-color: #94a3b8; }

            @media (prefers-color-scheme: dark) {
                .occ-card      { background: #09090b; border-color: #27272a; border-left-color: #71717a; }
                .occ-card-at   { background: rgba(136, 19, 55, 0.16); border-color: rgba(244, 63, 94, 0.28); border-left-color: #fb7185; }
                .occ-card-fa   { background: rgba(127, 29, 29, 0.16); border-color: rgba(239, 68, 68, 0.28); border-left-color: #f87171; }
                .occ-card-he   { background: rgba(120, 53, 15, 0.16); border-color: rgba(245, 158, 11, 0.28); border-left-color: #fbbf24; }
                .occ-card-td   { background: rgba(88, 28, 135, 0.16); border-color: rgba(168, 85, 247, 0.28); border-left-color: #c084fc; }
                .occ-card-f    { background: rgba(20, 83, 45, 0.16); border-color: rgba(34, 197, 94, 0.28); border-left-color: #4ade80; }
                .occ-card-ea   { background: rgba(22, 78, 99, 0.18); border-color: rgba(6, 182, 212, 0.28); border-left-color: #22d3ee; }
                .occ-card-sa   { background: rgba(19, 78, 74, 0.18); border-color: rgba(20, 184, 166, 0.28); border-left-color: #2dd4bf; }
                .occ-card-dm   { background: rgba(49, 46, 129, 0.18); border-color: rgba(99, 102, 241, 0.28); border-left-color: #818cf8; }
                .occ-card-ep   { background: rgba(12, 74, 110, 0.18); border-color: rgba(14, 165, 233, 0.28); border-left-color: #38bdf8; }
                .occ-card-note { border-left-color: #71717a; }
            }

            .occ-pill {
                display: inline-flex;
                align-items: center;
                padding: 2px 8px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 900;
                line-height: 1.25;
                border: 1px solid transparent;
            }
            .occ-pill-note { background: #e2e8f0; color: #1e293b; border-color: #cbd5e1; }
            .occ-pill-he   { background: #fef3c7; color: #92400e; border-color: #fde68a; }
            .occ-pill-td   { background: #f3e8ff; color: #6b21a8; border-color: #ddd6fe; }
            .occ-pill-f    { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
            .occ-pill-fa   { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
            .occ-pill-ea   { background: #cffafe; color: #0e7490; border-color: #a5f3fc; }
            .occ-pill-sa   { background: #ccfbf1; color: #0f766e; border-color: #99f6e4; }
            .occ-pill-dm   { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }
            .occ-pill-ep   { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
            .occ-pill-at   { background: #ffe4e6; color: #be123c; border-color: #fecdd3; }

            @media (prefers-color-scheme: dark) {
                .occ-pill-note { background: #27272a; color: #e4e4e7; border-color: #3f3f46; }
                .occ-pill-he   { background: rgba(120, 53, 15, 0.45); color: #fcd34d; border-color: rgba(245, 158, 11, 0.35); }
                .occ-pill-td   { background: rgba(88, 28, 135, 0.45); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.35); }
                .occ-pill-f    { background: rgba(20, 83, 45, 0.45); color: #86efac; border-color: rgba(34, 197, 94, 0.35); }
                .occ-pill-fa   { background: rgba(127, 29, 29, 0.5); color: #fca5a5; border-color: rgba(239, 68, 68, 0.4); }
                .occ-pill-ea   { background: rgba(22, 78, 99, 0.5); color: #67e8f9; border-color: rgba(6, 182, 212, 0.35); }
                .occ-pill-sa   { background: rgba(19, 78, 74, 0.5); color: #5eead4; border-color: rgba(20, 184, 166, 0.35); }
                .occ-pill-dm   { background: rgba(49, 46, 129, 0.5); color: #a5b4fc; border-color: rgba(99, 102, 241, 0.35); }
                .occ-pill-ep   { background: rgba(12, 74, 110, 0.5); color: #7dd3fc; border-color: rgba(14, 165, 233, 0.35); }
                .occ-pill-at   { background: rgba(136, 19, 55, 0.5); color: #fda4af; border-color: rgba(244, 63, 94, 0.4); }
            }

            .a4-preview-frame.is-sup-preview {
                aspect-ratio: auto !important;
                max-height: 44vh;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch;
            }
            .a4-preview-spacer { position: relative; width: 100%; min-height: 100%; }
            .a4-preview-frame.is-sup-preview .a4-preview-scaler { height: auto !important; }

            .sup-sheet {
                width: 1122px;
                min-height: 793px;
                box-sizing: border-box;
                background: #ffffff;
                color: #0f172a;
                padding: 24px 28px 20px 28px;
                display: flex;
                flex-direction: column;
                font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .sup-breakdown-wrap {
                margin-top: 12px;
                display: grid;
                grid-template-columns: repeat(5, 1fr) 1.15fr;
                gap: 7px;
            }
            .sup-cat-box {
                border: 1.2px solid #cbd5e1;
                border-radius: 9px;
                background: #f8fafc;
                padding: 7px 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
            }
            .sup-cat-box.is-total {
                background: #0f172a;
                border-color: #0f172a;
                color: #ffffff;
            }
            .sup-cat-lbl {
                font-size: 8.5px;
                font-weight: 900;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: #475569;
                line-height: 1.15;
            }
            .sup-cat-box.is-total .sup-cat-lbl { color: #cbd5e1; }
            .sup-cat-num {
                font-size: 19px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }
            .sup-cat-box.is-total .sup-cat-num { color: #ffffff; font-size: 22px; }

            .sup-meta-row {
                margin-top: 8px;
                display: grid;
                grid-template-columns: 1fr 1.6fr;
                gap: 8px;
            }
            .sup-meta-card {
                border: 1px solid #cbd5e1;
                border-radius: 9px;
                background: #f8fafc;
                padding: 6px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            .sup-meta-lbl {
                font-size: 9px;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: #64748b;
            }
            .sup-meta-val {
                font-size: 12px;
                font-weight: 900;
                color: #0f172a;
                font-variant-numeric: tabular-nums;
            }
            .sup-meta-teams {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 11px;
                font-weight: 800;
                color: #334155;
                font-variant-numeric: tabular-nums;
            }

            .sup-table-wrap {
                margin-top: 12px;
                border: 1.5px solid #334155;
                border-radius: 10px;
                overflow: hidden;
                flex: 1;
            }
            .sup-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }
            .sup-table thead th {
                background: #0f172a;
                color: #ffffff;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                text-align: left;
                padding: 9px 11px;
                border-right: 1px solid #334155;
            }
            .sup-table thead th:last-child { border-right: none; }
            .sup-table tbody td {
                padding: 9px 11px;
                border-top: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                vertical-align: top;
                text-align: left;
                font-size: 11.5px;
            }
            .sup-table tbody td:last-child { border-right: none; }
            .sup-table tbody tr:nth-child(even) { background: #f8fafc; }
            .sup-table tbody tr:nth-child(odd) { background: #ffffff; }

            .sup-col-date { width: 88px; }
            .sup-col-team { width: 196px; }
            .sup-col-occ { width: 282px; }

            .sup-date-main {
                display: block;
                font-size: 14px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.1;
                font-variant-numeric: tabular-nums;
            }
            .sup-date-dow {
                display: block;
                font-size: 9.5px;
                font-weight: 800;
                text-transform: uppercase;
                color: #64748b;
                margin-top: 2px;
            }
            .sup-is-red .sup-date-main { color: #dc2626; }
            .sup-is-red .sup-date-dow { color: #ef4444; }

            .sup-team-cell { display: flex; align-items: flex-start; gap: 8px; }
            .sup-team-letter-badge {
                width: 24px;
                height: 24px;
                border-radius: 6px;
                background: #0f172a;
                color: #ffffff;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 900;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .sup-team-names {
                display: block;
                font-size: 11.5px;
                font-weight: 800;
                color: #0f172a;
                line-height: 1.25;
                word-break: break-word;
            }

            .sup-shift-cell { display: flex; align-items: flex-start; gap: 8px; }
            .sup-shift-chip {
                min-width: 34px;
                height: 22px;
                padding: 0 5px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 900;
                flex-shrink: 0;
            }
            .sup-shift-reason {
                display: block;
                font-size: 11px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.25;
                word-break: break-word;
            }
            .sup-shift-sub {
                display: block;
                font-size: 9.8px;
                font-weight: 700;
                color: #475569;
                margin-top: 2px;
                font-variant-numeric: tabular-nums;
                word-break: break-word;
            }

            .sup-obs-text {
                font-size: 12px;
                font-weight: 600;
                color: #0f172a;
                line-height: 1.42;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .sup-obs-empty { color: #94a3b8; font-weight: 700; }
            .sup-empty-box {
                padding: 48px 24px;
                text-align: center;
                background: #f8fafc;
                color: #64748b;
                font-size: 13px;
                font-weight: 700;
            }

            .sup-sign-grid {
                margin-top: 20px;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 28px;
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .sup-sign-box { text-align: center; padding-top: 26px; }
            .sup-sign-line { border-top: 1.5px solid #475569; padding-top: 5px; font-size: 10px; font-weight: 800; color: #334155; }

            @media print {
                #print-sheet.is-supervisor-print .sup-sheet {
                    width: 100% !important;
                    min-height: 0 !important;
                    height: auto !important;
                    max-height: none !important;
                    padding: 3mm 4mm 2mm 4mm !important;
                    margin: 0 !important;
                }
                #print-sheet.is-supervisor-print .sup-table-wrap {
                    overflow: visible !important;
                    border-radius: 6px !important;
                }
                #print-sheet.is-supervisor-print .sup-table thead { display: table-header-group !important; }
                #print-sheet.is-supervisor-print .sup-table tbody tr,
                #print-sheet.is-supervisor-print .sup-sign-grid,
                #print-sheet.is-supervisor-print .a4-footer {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /* 4. MONTAGEM DA PÁGINA PRINCIPAL, LEGENDA E MODAIS */
    function ensureOccurrencesSectionDOM() {
        const bottomGrid = document.getElementById('bottom-cards-grid');
        if (!bottomGrid) return null;

        let sec = document.getElementById('occurrences-summary-section');
        if (!sec) {
            sec = document.createElement('section');
            sec.id = 'occurrences-summary-section';
            sec.className = 'hidden bg-slate-50 dark:bg-surface border border-slate-200 dark:border-surfaceBorder rounded-2xl p-4 md:p-5';
            sec.innerHTML = `
                <div class="flex items-center justify-between gap-2 mb-3">
                    <h3 id="occurrences-summary-title" class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span>Observações &amp; Ocorrências do Mês</span>
                    </h3>
                    <span id="occurrences-summary-badge" class="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black tabular-nums"></span>
                </div>
                <div id="occurrences-summary-container" class="space-y-2.5"></div>
            `;
            bottomGrid.insertBefore(sec, bottomGrid.firstChild);
        }

        const oldAtSec = document.getElementById('atestado-summary-section');
        if (oldAtSec) oldAtSec.classList.add('hidden');

        return sec;
    }

    function upgradeInfoModalDOM() {
        const panel = document.getElementById('info-modal-content');
        if (!panel || panel.dataset.v8Upgraded === '1') return;
        panel.dataset.v8Upgraded = '1';

        panel.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-black text-slate-800 dark:text-white leading-tight">Legenda</h3>
                <button type="button" onclick="closeInfoModal()" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-slate-300 cursor-pointer btn-smooth" aria-label="Fechar legenda">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="space-y-4">
                <div>
                    <span class="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Turnos &amp; Afastamentos</span>
                    <div class="grid grid-cols-2 gap-1.5">
                        <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 flex items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs shrink-0">M</span><span class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">Manhã</span></div>
                            <span class="font-extrabold text-blue-700 dark:text-blue-400 text-[10.5px] tabular-nums shrink-0">05-13h</span>
                        </div>
                        <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 flex items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-black text-xs shrink-0">T</span><span class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">Tarde</span></div>
                            <span class="font-extrabold text-orange-700 dark:text-orange-400 text-[10.5px] tabular-nums shrink-0">13-21h</span>
                        </div>
                        <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 flex items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-xs shrink-0">N</span><span class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">Noite</span></div>
                            <span class="font-extrabold text-indigo-700 dark:text-indigo-400 text-[10.5px] tabular-nums shrink-0">21-05h</span>
                        </div>
                        <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 flex items-center justify-center rounded-md bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-black text-xs shrink-0">F</span><span class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">Folga</span></div>
                            <span class="font-extrabold text-green-700 dark:text-green-400 text-[10px] uppercase shrink-0">Descanso</span>
                        </div>
                        <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 flex items-center justify-center rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-black text-[10px] shrink-0">AT</span><span class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">Atestado</span></div>
                            <span class="font-extrabold text-rose-700 dark:text-rose-400 text-[10px] uppercase shrink-0">Afast.</span>
                        </div>
                        <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 flex items-center justify-center rounded-md bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-black text-[10px] shrink-0">FA</span><span class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">Falta</span></div>
                            <span class="font-extrabold text-red-700 dark:text-red-400 text-[10px] uppercase shrink-0">Ausência</span>
                        </div>
                    </div>
                </div>

                <div>
                    <span class="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Ocorrências &amp; Marcadores</span>
                    <div class="grid grid-cols-2 gap-1.5">
                        <div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-6 h-6 flex items-center justify-center rounded-md bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 font-black text-[10px] shrink-0">EA</span>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">Entrada Atrasada</span>
                        </div>
                        <div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-6 h-6 flex items-center justify-center rounded-md bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 font-black text-[10px] shrink-0">SA</span>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">Saída Adiantada</span>
                        </div>
                        <div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-6 h-6 flex items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 font-black text-[10px] shrink-0">DM</span>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">Declaração Médica</span>
                        </div>
                        <div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-6 h-6 flex items-center justify-center rounded-md bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 font-black text-[10px] shrink-0">EP</span>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">Exame Periódico</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-1.5 mt-1.5">
                        <div class="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                            <span class="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate">Hora Extra</span>
                        </div>
                        <div class="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                            <span class="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate">Troca</span>
                        </div>
                        <div class="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-slate-50 dark:bg-oled border border-slate-200/80 dark:border-surfaceBorder">
                            <span class="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
                            <span class="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate">Dia de Volta</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-3.5 border-t border-slate-200 dark:border-surfaceBorder">
                <span class="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 text-center">Backup de Equipes, Notas e Atestados</span>
                <div class="grid grid-cols-2 gap-2">
                    <button type="button" onclick="exportBackup()" class="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-surfaceBorder dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 btn-smooth cursor-pointer">Exportar</button>
                    <button type="button" onclick="document.getElementById('backup-file-input').click()" class="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-surfaceBorder dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 btn-smooth cursor-pointer">Importar</button>
                    <input type="file" id="backup-file-input" accept=".json" class="hidden" onchange="importBackup(event)">
                </div>
            </div>
        `;
    }

    function upgradeNoteModalDOM() {
        const panel = document.getElementById('modal-content');
        if (!panel || panel.dataset.v8Upgraded === '1') return;
        panel.dataset.v8Upgraded = '1';

        panel.innerHTML = `
            <div class="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-surfaceBorder rounded-full mx-auto mb-3.5"></div>
            <div class="flex justify-between items-center mb-3.5">
                <h3 id="modal-date-title" class="text-lg font-black text-slate-800 dark:text-white leading-tight"></h3>
                <button type="button" onclick="requestCloseModal()" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-slate-300 cursor-pointer btn-smooth" aria-label="Fechar janela">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="mb-3.5">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo de Ocorrência</span>
                    <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Toque novamente p/ desmarcar</span>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                    <button type="button" data-ov="HE50" onclick="selectOverride('HE50')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Hora Extra 50%</button>
                    <button type="button" data-ov="HE75" onclick="selectOverride('HE75')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Hora Extra 75%</button>
                    <button type="button" data-ov="HE110" onclick="selectOverride('HE110')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Hora Extra 110%</button>
                    <button type="button" data-ov="TD" onclick="selectOverride('TD')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Troca de Dia</button>
                    <button type="button" data-ov="F" onclick="selectOverride('F')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Folga</button>
                    <button type="button" data-ov="FA" onclick="selectOverride('FA')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Falta</button>
                    <button type="button" data-ov="EA" onclick="selectOverride('EA')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Entrada Atrasada</button>
                    <button type="button" data-ov="SA" onclick="selectOverride('SA')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Saída Adiantada</button>
                    <button type="button" data-ov="DM" onclick="selectOverride('DM')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Declaração Médica</button>
                    <button type="button" data-ov="EP" onclick="selectOverride('EP')" class="ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Exame Periódico</button>
                </div>
                <button type="button" id="ov-atestado-btn" onclick="toggleAtestadoMode()" class="mt-1.5 w-full py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Atestado Médico</button>

                <div id="override-details-box" class="hidden mt-3 rounded-2xl border p-3 space-y-2.5">
                    <div>
                        <span id="override-who-label" class="block text-[11px] font-extrabold mb-1.5"></span>
                        <div id="override-who-group" class="grid grid-cols-3 gap-1.5"></div>
                    </div>

                    <div id="override-times-wrap" class="hidden space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div id="time-field-entry" class="hidden">
                                <label id="time-label-entry" for="occ-time-entry" class="block text-[11px] font-extrabold mb-1">Hora que entrou</label>
                                <input type="time" id="occ-time-entry" oninput="onOccTimeChange('entry', this.value)" class="w-full px-3 py-1.5 text-base font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-oled border border-slate-200 dark:border-surfaceBorder rounded-xl outline-none focus:ring-2 focus:ring-blue-500 tabular-nums">
                            </div>
                            <div id="time-field-exit" class="hidden">
                                <label id="time-label-exit" for="occ-time-exit" class="block text-[11px] font-extrabold mb-1">Hora que saiu</label>
                                <input type="time" id="occ-time-exit" oninput="onOccTimeChange('exit', this.value)" class="w-full px-3 py-1.5 text-base font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-oled border border-slate-200 dark:border-surfaceBorder rounded-xl outline-none focus:ring-2 focus:ring-blue-500 tabular-nums">
                            </div>
                            <div id="time-field-arrival" class="hidden sm:col-span-2">
                                <label id="time-label-arrival" for="occ-time-arrival" class="block text-[11px] font-extrabold mb-1">Hora que chegou</label>
                                <input type="time" id="occ-time-arrival" oninput="onOccTimeChange('arrival', this.value)" class="w-full px-3 py-1.5 text-base font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-oled border border-slate-200 dark:border-surfaceBorder rounded-xl outline-none focus:ring-2 focus:ring-blue-500 tabular-nums">
                            </div>
                        </div>
                        <p id="occ-time-helper" class="hidden text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-oled/70 border border-black/10 dark:border-white/10"></p>
                    </div>

                    <div id="swap-target-section" class="hidden pt-2 border-t border-purple-200/70 dark:border-purple-900/50 space-y-2">
                        <span class="block text-[11px] font-extrabold text-purple-900 dark:text-purple-200">Troca com quem?</span>
                        <div id="swap-presets-group" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5"></div>
                        <input type="text" id="swap-custom-input" maxlength="40" autocomplete="off" oninput="onSwapCustomInput()" placeholder="Ou digite outro nome..." class="w-full px-3 py-1.5 text-base font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-oled border border-purple-200 dark:border-purple-900/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-slate-400 dark:placeholder:text-slate-500">
                    </div>

                    <div id="cover-target-section" class="hidden pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
                        <label for="occ-covered-by-input" class="block text-[11px] font-extrabold">Quem cobriu / assumiu o posto (opcional):</label>
                        <input type="text" id="occ-covered-by-input" maxlength="40" autocomplete="off" oninput="onCoveredByInput()" placeholder="Ex.: operador substituto..." class="w-full px-3 py-1.5 text-base font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-oled border border-slate-200 dark:border-surfaceBorder rounded-xl outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500">
                    </div>
                </div>

                <div id="atestado-controls" class="hidden mt-3 rounded-2xl border border-rose-200/90 dark:border-rose-900/60 bg-rose-50/75 dark:bg-rose-950/25 p-3 space-y-2.5">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-black text-rose-800 dark:text-rose-200">Configuração do Atestado Médico</span>
                        <span id="atestado-subtitle" class="text-[10px] font-bold text-rose-600 dark:text-rose-300"></span>
                    </div>
                    <p id="atestado-origin-notice" class="hidden text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-white/75 dark:bg-oled/60 border border-rose-200 dark:border-rose-900/40 rounded-xl px-3 py-2 leading-snug"></p>
                    <div>
                        <span class="block text-[11px] font-extrabold text-rose-900 dark:text-rose-200 mb-1.5">Quem está de atestado:</span>
                        <div id="atestado-who-group" class="grid grid-cols-3 gap-1.5"></div>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-extrabold text-rose-900 dark:text-rose-200">Quantidade de dias:</span>
                        <div class="flex items-center gap-1.5">
                            <button type="button" onclick="adjustAtestadoDays(-1)" aria-label="Diminuir dias" class="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-black text-base flex items-center justify-center active:scale-90 btn-smooth cursor-pointer">−</button>
                            <input type="number" id="atestado-days-input" inputmode="numeric" pattern="[0-9]*" min="1" max="180" value="1" oninput="onAtestadoDaysInput()" class="w-14 h-8 text-center text-base font-black text-rose-800 dark:text-rose-200 bg-white dark:bg-oled border border-rose-200 dark:border-rose-900/50 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 tabular-nums">
                            <button type="button" onclick="adjustAtestadoDays(1)" aria-label="Aumentar dias" class="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-black text-base flex items-center justify-center active:scale-90 btn-smooth cursor-pointer">+</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-5 gap-1.5">
                        <button type="button" onclick="setAtestadoDays(1)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">1d</button>
                        <button type="button" onclick="setAtestadoDays(3)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">3d</button>
                        <button type="button" onclick="setAtestadoDays(5)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">5d</button>
                        <button type="button" onclick="setAtestadoDays(7)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">7d</button>
                        <button type="button" onclick="setAtestadoDays(15)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">15d</button>
                    </div>
                    <div id="atestado-preview-box" class="rounded-xl bg-sky-50 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-900/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 leading-snug"></div>
                </div>
            </div>

            <textarea id="note-text" oninput="markModalDirty()" class="w-full h-24 md:h-28 p-3.5 text-base font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-oled border border-slate-200 dark:border-surfaceBorder rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600" placeholder="Observações para este dia..."></textarea>

            <div id="unsaved-guard" class="hidden mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/60 px-3 py-2.5 flex items-center justify-between gap-2">
                <span class="text-xs font-extrabold text-amber-800 dark:text-amber-300">Alterações não salvas</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="closeModal()" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-oled border border-slate-200 dark:border-surfaceBorder active:scale-95 btn-smooth cursor-pointer">Descartar</button>
                    <button type="button" onclick="saveNote()" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 btn-smooth cursor-pointer">Salvar</button>
                </div>
            </div>

            <div class="flex gap-3 mt-4 pb-2 md:pb-0">
                <button type="button" onclick="deleteNote()" class="w-1/3 py-3.5 rounded-2xl font-bold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100/80 dark:bg-red-900/20 dark:hover:bg-red-900/35 border border-red-100 dark:border-red-900/30 active:scale-95 btn-smooth cursor-pointer">Limpar</button>
                <button type="button" onclick="saveNote()" class="w-2/3 py-3.5 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 active:scale-95 btn-smooth cursor-pointer">Salvar</button>
            </div>
        `;
    }

    function upgradeExportModalDOM() {
        const panel = document.getElementById('export-modal-content');
        if (!panel || panel.dataset.v8Upgraded === '1') return;
        panel.dataset.v8Upgraded = '1';

        panel.innerHTML = `
            <div class="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-surfaceBorder rounded-full mx-auto mb-4"></div>
            <div class="flex justify-between items-start gap-3 mb-3.5">
                <div class="min-w-0">
                    <span id="export-mode-pill" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-200/70 dark:border-blue-900/50 mb-1.5">Gerar / Imprimir Relatório</span>
                    <h3 id="export-modal-title" class="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight">Gerar / Imprimir Relatório</h3>
                    <p id="export-modal-subtitle" class="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Escala oficial dos 4 turnos em A4 horizontal ou relatório mensal de ocorrências.</p>
                </div>
                <button type="button" onclick="closeExportModal()" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-slate-300 cursor-pointer btn-smooth shrink-0" aria-label="Fechar janela">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-oled border border-slate-200 dark:border-surfaceBorder mb-4">
                <button type="button" id="export-tab-quadro" onclick="switchExportMode('quadro')" class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer">
                    <span>Quadro dos Turnos</span>
                </button>
                <button type="button" id="export-tab-supervisor" onclick="switchExportMode('supervisor')" class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer">
                    <span class="truncate">Ocorrências Mensais</span>
                    <span id="sup-tab-badge" class="px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums shrink-0">0</span>
                </button>
            </div>

            <div id="export-supervisor-options" class="hidden rounded-2xl bg-slate-50 dark:bg-oled border border-slate-200 dark:border-surfaceBorder p-3.5 mb-4 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Filtrar Turno</span>
                    <div class="grid grid-cols-5 gap-1.5" id="sup-team-filters">
                        <button type="button" data-sup-team="all" onclick="setSupervisorTeamFilter('all')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Todos</button>
                        <button type="button" data-sup-team="0" onclick="setSupervisorTeamFilter('0')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">A</button>
                        <button type="button" data-sup-team="1" onclick="setSupervisorTeamFilter('1')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">B</button>
                        <button type="button" data-sup-team="2" onclick="setSupervisorTeamFilter('2')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">C</button>
                        <button type="button" data-sup-team="3" onclick="setSupervisorTeamFilter('3')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">D</button>
                    </div>
                </div>

                <div class="pt-2.5 border-t border-slate-200/80 dark:border-surfaceBorder space-y-1.5">
                    <span class="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Categoria</span>
                    <div class="flex flex-wrap gap-1.5" id="sup-cat-filters">
                        <button type="button" data-sup-cat="all" onclick="setSupervisorCategoryFilter('all')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Todas</button>
                        <button type="button" data-sup-cat="he" onclick="setSupervisorCategoryFilter('he')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Hora Extra</button>
                        <button type="button" data-sup-cat="at" onclick="setSupervisorCategoryFilter('at')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Atestados</button>
                        <button type="button" data-sup-cat="fa" onclick="setSupervisorCategoryFilter('fa')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Faltas</button>
                        <button type="button" data-sup-cat="td" onclick="setSupervisorCategoryFilter('td')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Trocas</button>
                        <button type="button" data-sup-cat="ea_sa" onclick="setSupervisorCategoryFilter('ea_sa')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Ent./Saí.</button>
                        <button type="button" data-sup-cat="dm_ep" onclick="setSupervisorCategoryFilter('dm_ep')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Decl./Exame</button>
                        <button type="button" data-sup-cat="other" onclick="setSupervisorCategoryFilter('other')" class="sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer">Obs./Outras</button>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-surfaceBorder">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ordenação</span>
                        <span id="sup-count-pill" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 tabular-nums"></span>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <button type="button" id="sup-sort-date-btn" data-sup-sort="date" onclick="setSupervisorSortMode('date')" class="sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Por Data (1 → 30)</button>
                        <button type="button" data-sup-sort="team" onclick="setSupervisorSortMode('team')" class="sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Por Turno (A → D)</button>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span id="export-preview-caption" class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">Prévia da Folha A4 (Paisagem • 1 Página)</span>
                    <span id="export-month-badge" class="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase shrink-0"></span>
                </div>
                <div id="a4-preview-frame" class="a4-preview-frame">
                    <div id="a4-preview-spacer" class="a4-preview-spacer">
                        <div id="a4-preview-scaler" class="a4-preview-scaler"></div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button type="button" onclick="printA4Schedule()" class="py-3.5 px-4 rounded-2xl font-extrabold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                    <span id="export-print-btn-label">Imprimir / Salvar PDF (A4)</span>
                </button>
                <button type="button" onclick="triggerExportPNG()" class="py-3.5 px-4 rounded-2xl font-extrabold text-sm text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                    <svg class="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    <span id="export-png-btn-label">Baixar Imagem A4 HD (.PNG)</span>
                </button>
            </div>

            <button type="button" id="sup-copy-btn" onclick="copySupervisorSummary()" class="hidden w-full mt-2.5 py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                <span>Copiar / Compartilhar Relatório (Texto)</span>
            </button>
        `;
    }

    function upgradeDesktopInlineLegend() {
        const legendRow = document.querySelector('section .hidden.md\\:flex.items-center.gap-3');
        if (!legendRow || legendRow.dataset.v8Legend === '1') return;
        legendRow.dataset.v8Legend = '1';
        [
            { cls: 'bg-red-600', label: 'Falta' },
            { cls: 'bg-purple-500', label: 'Troca' },
            { cls: 'bg-cyan-500', label: 'Ent. Atrasada' },
            { cls: 'bg-teal-500', label: 'Saí. Adiantada' },
            { cls: 'bg-indigo-500', label: 'Decl. Médica' },
            { cls: 'bg-sky-500', label: 'Ex. Periódico' }
        ].forEach(it => {
            const span = document.createElement('span');
            span.className = 'flex items-center gap-1';
            span.innerHTML = `<span class="w-2 h-2 rounded-full ${it.cls}"></span>${it.label}`;
            legendRow.appendChild(span);
        });
    }

    /* 5. INTERAÇÕES DO MODAL DE OCORRÊNCIAS, HORÁRIOS E ATESTADO */
    function renderAtestadoWhoButtons() {
        const group = document.getElementById('atestado-who-group');
        if (!group) return;
        const members = parseTeamMembers(teamNames[currentTurma]);
        let options;
        if (members.length >= 2) {
            options = [
                { val: '0', label: members[0] },
                { val: '1', label: members[1] },
                { val: 'both', label: 'Os dois' }
            ];
            group.className = 'grid grid-cols-3 gap-1.5';
        } else {
            const single = members[0] || teamNames[currentTurma];
            options = [{ val: '0', label: single }];
            modalAtestadoWho = '0';
            group.className = 'grid grid-cols-1 gap-1.5';
        }

        group.innerHTML = options.map(opt => {
            const act = modalAtestadoWho === opt.val;
            const cls = act
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                : 'bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200';
            return `<button type="button" onclick="selectAtestadoWho('${opt.val}')" class="py-2 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer ${cls}" title="${escapeHTML(opt.label)}">${escapeHTML(opt.label)}</button>`;
        }).join('');
    }

    function syncSwapPresetsHighlight() {
        const swapGroup = document.getElementById('swap-presets-group');
        if (!swapGroup) return;
        swapGroup.querySelectorAll('button[data-swap-name]').forEach(btn => {
            const pName = btn.getAttribute('data-swap-name') || '';
            const pTeam = btn.getAttribute('data-swap-team') || '';
            const isSelected = modalSwapWith === pName && (modalSwapWithTeam === pTeam || !modalSwapWithTeam);
            btn.className = `py-1.5 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer ${isSelected
                ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                : 'bg-white hover:bg-purple-100/60 dark:bg-oled dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-200'}`;
        });
    }

    function updateTimeHelperFeedback(code) {
        const helper = document.getElementById('occ-time-helper');
        if (!helper) return;
        const fields = (OCC_META[code] && Array.isArray(OCC_META[code].timeFields)) ? OCC_META[code].timeFields : [];
        if (!fields.length) {
            helper.classList.add('hidden');
            return;
        }
        const dt = parseDateKey(currentModalDateStr);
        const baseCfg = SHIFTS_CONFIG[getShift(dt.getFullYear(), dt.getMonth(), dt.getDate(), currentTurma)] || SHIFTS_CONFIG.M;
        const info = buildOccurrenceDetailSummary(code, {
            entryTime: modalEntryTime,
            exitTime: modalExitTime,
            arrivalTime: modalArrivalTime
        }, baseCfg);

        if (info.warning) {
            helper.innerText = `Aviso: ${info.warning}`;
            helper.className = 'text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800';
            helper.classList.remove('hidden');
            return;
        }

        if (fields.includes('entry') && fields.includes('exit')) {
            const dur = formatDurationBetween(modalEntryTime, modalExitTime);
            if (dur) {
                const verb = code === 'DM' ? 'Afastamento calculado' : 'Duração calculada';
                helper.innerText = `${verb}: ${dur}`;
                helper.className = 'text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl bg-white/85 dark:bg-oled/75 text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10';
                helper.classList.remove('hidden');
                return;
            }
        }
        helper.classList.add('hidden');
    }

    function renderOverrideTimeFieldsUI(code, meta, labelCls) {
        const wrap = document.getElementById('override-times-wrap');
        const entryBox = document.getElementById('time-field-entry');
        const exitBox = document.getElementById('time-field-exit');
        const arrivalBox = document.getElementById('time-field-arrival');
        const entryLbl = document.getElementById('time-label-entry');
        const exitLbl = document.getElementById('time-label-exit');
        const arrivalLbl = document.getElementById('time-label-arrival');
        const entryInp = document.getElementById('occ-time-entry');
        const exitInp = document.getElementById('occ-time-exit');
        const arrivalInp = document.getElementById('occ-time-arrival');
        if (!wrap || !entryBox || !exitBox || !arrivalBox) return;

        const fields = (meta && Array.isArray(meta.timeFields)) ? meta.timeFields : [];
        if (!fields.length) {
            wrap.classList.add('hidden');
            return;
        }

        wrap.classList.remove('hidden');
        entryBox.classList.toggle('hidden', !fields.includes('entry'));
        exitBox.classList.toggle('hidden', !fields.includes('exit'));
        arrivalBox.classList.toggle('hidden', !fields.includes('arrival'));

        if (entryLbl) { entryLbl.className = `block text-[11px] font-extrabold mb-1 ${labelCls}`; entryLbl.innerText = 'Hora que entrou'; }
        if (exitLbl)  { exitLbl.className = `block text-[11px] font-extrabold mb-1 ${labelCls}`; exitLbl.innerText = 'Hora que saiu'; }
        if (arrivalLbl) { arrivalLbl.className = `block text-[11px] font-extrabold mb-1 ${labelCls}`; arrivalLbl.innerText = 'Hora que chegou'; }

        if (entryInp && document.activeElement !== entryInp) entryInp.value = modalEntryTime;
        if (exitInp && document.activeElement !== exitInp) exitInp.value = modalExitTime;
        if (arrivalInp && document.activeElement !== arrivalInp) arrivalInp.value = modalArrivalTime;
        updateTimeHelperFeedback(code);
    }

    function renderOverrideDetailsUI() {
        const box = document.getElementById('override-details-box');
        const labelEl = document.getElementById('override-who-label');
        const whoGroup = document.getElementById('override-who-group');
        const swapSec = document.getElementById('swap-target-section');
        const swapGroup = document.getElementById('swap-presets-group');
        const swapInput = document.getElementById('swap-custom-input');
        const coverSec = document.getElementById('cover-target-section');
        const coverInp = document.getElementById('occ-covered-by-input');
        if (!box || !labelEl || !whoGroup) return;

        const code = modalAtestadoEnabled ? '' : currentSelectedOverride;
        const meta = OCC_META[code];
        if (!meta || !meta.hasWho) {
            box.classList.add('hidden');
            return;
        }

        box.classList.remove('hidden');

        const themes = {
            HE: {
                box: 'border-amber-200/90 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/20',
                lbl: 'text-amber-900 dark:text-amber-200',
                act: 'bg-amber-500 border-amber-500 text-white shadow-sm',
                idle: 'bg-white hover:bg-amber-100/60 dark:bg-oled dark:hover:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200',
                title: `Quem fez a ${meta.label}?`
            },
            FA: {
                box: 'border-red-200/90 dark:border-red-900/60 bg-red-50/75 dark:bg-red-950/20',
                lbl: 'text-red-900 dark:text-red-200',
                act: 'bg-red-600 border-red-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-red-100/60 dark:bg-oled dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200',
                title: 'Quem faltou neste dia?'
            },
            TD: {
                box: 'border-purple-200/90 dark:border-purple-900/60 bg-purple-50/75 dark:bg-purple-950/20',
                lbl: 'text-purple-900 dark:text-purple-200',
                act: 'bg-purple-600 border-purple-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-purple-100/60 dark:bg-oled dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-900/50 text-purple-800 dark:text-purple-200',
                title: `Quem do Turno ${TEAM_LETTERS[currentTurma]} está trocando?`
            },
            EA: {
                box: 'border-cyan-200/90 dark:border-cyan-900/60 bg-cyan-50/75 dark:bg-cyan-950/20',
                lbl: 'text-cyan-900 dark:text-cyan-200',
                act: 'bg-cyan-600 border-cyan-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-cyan-100/60 dark:bg-oled dark:hover:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/50 text-cyan-900 dark:text-cyan-200',
                title: 'Quem teve Entrada Atrasada?'
            },
            SA: {
                box: 'border-teal-200/90 dark:border-teal-900/60 bg-teal-50/75 dark:bg-teal-950/20',
                lbl: 'text-teal-900 dark:text-teal-200',
                act: 'bg-teal-600 border-teal-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-teal-100/60 dark:bg-oled dark:hover:bg-teal-950/40 border-teal-200 dark:border-teal-900/50 text-teal-900 dark:text-teal-200',
                title: 'Quem teve Saída Adiantada?'
            },
            DM: {
                box: 'border-indigo-200/90 dark:border-indigo-900/60 bg-indigo-50/75 dark:bg-indigo-950/20',
                lbl: 'text-indigo-900 dark:text-indigo-200',
                act: 'bg-indigo-600 border-indigo-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-indigo-100/60 dark:bg-oled dark:hover:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200',
                title: 'Quem apresentou Declaração Médica?'
            },
            EP: {
                box: 'border-sky-200/90 dark:border-sky-900/60 bg-sky-50/75 dark:bg-sky-950/20',
                lbl: 'text-sky-900 dark:text-sky-200',
                act: 'bg-sky-600 border-sky-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-sky-100/60 dark:bg-oled dark:hover:bg-sky-950/40 border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-200',
                title: 'Quem fez Exame Periódico?'
            }
        };
        const th = themes[meta.palette] || themes.HE;

        box.className = `mt-3 rounded-2xl border p-3 space-y-2.5 ${th.box}`;
        labelEl.className = `block text-[11px] font-extrabold mb-1.5 ${th.lbl}`;
        labelEl.innerText = th.title;

        const members = parseTeamMembers(teamNames[currentTurma]);
        let options;
        if (members.length >= 2) {
            options = [
                { val: '0', label: members[0] },
                { val: '1', label: members[1] },
                { val: 'both', label: 'Os dois' }
            ];
            whoGroup.className = 'grid grid-cols-3 gap-1.5';
        } else {
            const single = members[0] || teamNames[currentTurma];
            options = [{ val: '0', label: single }];
            modalOverrideWho = '0';
            whoGroup.className = 'grid grid-cols-1 gap-1.5';
        }

        whoGroup.innerHTML = options.map(opt => {
            const act = modalOverrideWho === opt.val;
            return `<button type="button" onclick="selectOverrideWho('${opt.val}')" class="py-1.5 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer ${act ? th.act : th.idle}" title="${escapeHTML(opt.label)}">${escapeHTML(opt.label)}</button>`;
        }).join('');

        renderOverrideTimeFieldsUI(code, meta, th.lbl);

        if (swapSec && swapGroup && swapInput) {
            swapSec.classList.toggle('hidden', !meta.isSwap);
            if (meta.isSwap) {
                const presets = [];
                for (let tIdx = 0; tIdx < 4; tIdx++) {
                    if (tIdx === currentTurma) continue;
                    const tLtr = TEAM_LETTERS[tIdx];
                    parseTeamMembers(teamNames[tIdx]).forEach((mName, mIdx) => {
                        presets.push({ tIdx, mIdx, name: mName, teamLtr: tLtr });
                    });
                }
                swapGroup.innerHTML = presets.map(p => (
                    `<button type="button" data-swap-name="${escapeHTML(p.name)}" data-swap-team="${escapeHTML(p.teamLtr)}" onclick="selectSwapPreset(${p.tIdx}, ${p.mIdx})" class="py-1.5 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer" title="${escapeHTML(`${p.name} (Turno ${p.teamLtr})`)}">${escapeHTML(p.name)} <span class="opacity-70">(${escapeHTML(p.teamLtr)})</span></button>`
                )).join('');

                const matchesPreset = presets.some(p => modalSwapWith === p.name && (modalSwapWithTeam === p.teamLtr || !modalSwapWithTeam));
                if (document.activeElement !== swapInput) {
                    swapInput.value = matchesPreset ? '' : modalSwapWith;
                }
                syncSwapPresetsHighlight();
            }
        }

        if (coverSec && coverInp) {
            coverSec.classList.toggle('hidden', !meta.canCover);
            if (meta.canCover) {
                const cLbl = coverSec.querySelector('label');
                if (cLbl) cLbl.className = `block text-[11px] font-extrabold ${th.lbl}`;
                if (document.activeElement !== coverInp) coverInp.value = modalCoveredBy;
            }
        }
    }

    function syncOccurrenceButtonsUI() {
        const activeStyles = {
            HE50:  'bg-amber-500 border-amber-500 text-white shadow-sm',
            HE75:  'bg-amber-500 border-amber-500 text-white shadow-sm',
            HE110: 'bg-amber-600 border-amber-600 text-white shadow-sm',
            TD:    'bg-purple-600 border-purple-600 text-white shadow-sm',
            F:     'bg-green-600 border-green-600 text-white shadow-sm',
            FA:    'bg-red-600 border-red-600 text-white shadow-sm',
            EA:    'bg-cyan-600 border-cyan-600 text-white shadow-sm',
            SA:    'bg-teal-600 border-teal-600 text-white shadow-sm',
            DM:    'bg-indigo-600 border-indigo-600 text-white shadow-sm',
            EP:    'bg-sky-600 border-sky-600 text-white shadow-sm'
        };
        const idleStyle = 'bg-slate-50 hover:bg-slate-100 dark:bg-oled dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300';

        document.querySelectorAll('#note-modal .ov-btn').forEach(btn => {
            const val = btn.getAttribute('data-ov') || '';
            const isAct = !modalAtestadoEnabled && val === currentSelectedOverride;
            btn.className = `ov-btn py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer ${isAct ? (activeStyles[val] || idleStyle) : idleStyle}`;
        });

        const atBtn = document.getElementById('ov-atestado-btn');
        if (atBtn) {
            atBtn.className = `mt-1.5 w-full py-2 px-2.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer ${modalAtestadoEnabled
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                : 'bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/25 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'}`;
        }
    }

    window.selectAtestadoWho = function (val, silent = false) {
        if (!silent) { haptic(); markModalDirty(); }
        modalAtestadoWho = String(val || 'both');
        renderAtestadoWhoButtons();
        updateAtestadoPreview();
    };

    window.selectOverrideWho = function (val, silent = false) {
        if (!silent) { haptic(); markModalDirty(); }
        modalOverrideWho = String(val || 'both');
        renderOverrideDetailsUI();
    };

    window.onOccTimeChange = function (field, val) {
        markModalDirty();
        const clean = sanitizeTimeStr(val) || String(val || '').slice(0, 5);
        if (field === 'entry') modalEntryTime = clean;
        else if (field === 'exit') modalExitTime = clean;
        else if (field === 'arrival') modalArrivalTime = clean;
        if (!modalAtestadoEnabled && currentSelectedOverride) {
            updateTimeHelperFeedback(currentSelectedOverride);
        }
    };

    window.onCoveredByInput = function () {
        markModalDirty();
        const inp = document.getElementById('occ-covered-by-input');
        modalCoveredBy = inp ? inp.value.slice(0, 40) : '';
    };

    window.selectSwapPreset = function (tIdx, mIdx) {
        haptic();
        markModalDirty();
        const tLtr = TEAM_LETTERS[tIdx] || '';
        const tMembers = parseTeamMembers(teamNames[tIdx]);
        const name = tMembers[mIdx] || '';
        if (modalSwapWith === name && modalSwapWithTeam === tLtr) {
            modalSwapWith = '';
            modalSwapWithTeam = '';
        } else {
            modalSwapWith = name;
            modalSwapWithTeam = tLtr;
        }
        const swapInput = document.getElementById('swap-custom-input');
        if (swapInput) swapInput.value = '';
        syncSwapPresetsHighlight();
    };

    window.onSwapCustomInput = function () {
        markModalDirty();
        const swapInput = document.getElementById('swap-custom-input');
        modalSwapWith = swapInput ? swapInput.value.slice(0, 40) : '';
        modalSwapWithTeam = '';
        syncSwapPresetsHighlight();
    };

    window.selectOverride = function (code, silent = false) {
        if (!silent) {
            haptic();
            markModalDirty();
            if (code && currentSelectedOverride === code && !modalAtestadoEnabled) {
                code = '';
            }
        }
        currentSelectedOverride = code || '';
        if (currentSelectedOverride && modalAtestadoEnabled) {
            modalAtestadoEnabled = false;
            document.getElementById('atestado-controls')?.classList.add('hidden');
        }
        syncOccurrenceButtonsUI();
        renderOverrideDetailsUI();
    };

    window.updateAtestadoPreview = function () {
        const pv = document.getElementById('atestado-preview-box');
        if (!pv || !modalAtestadoStartDate) return;
        const days = Math.max(1, Math.min(180, parseInt(document.getElementById('atestado-days-input').value, 10) || 1));
        const ret = computeReturnInfo(modalAtestadoStartDate, days, currentTurma, modalEditingAtestadoId);
        const sh = SHIFTS_CONFIG[ret.returnShiftCode] || SHIFTS_CONFIG.M;
        const who = getSelectionWhoInfo(modalAtestadoWho, currentTurma);
        const pTxt = days === 1
            ? `${formatShortDate(modalAtestadoStartDate)} (1 dia)`
            : `${formatShortDate(modalAtestadoStartDate)} até ${formatShortDate(ret.endDate)} (${days} dias)`;
        const skip = ret.skippedFolgas > 0
            ? `<span class="block text-[10px] font-semibold text-sky-700/80 dark:text-sky-300/80 mt-0.5">Pulando ${ret.skippedFolgas} folga(s) normal(is).</span>`
            : '';
        pv.innerHTML = `<span class="block font-bold text-slate-700 dark:text-slate-200">Funcionário: <b class="text-rose-600 dark:text-rose-300">${escapeHTML(who.fullLabel)}</b></span><span class="block font-bold text-slate-600 dark:text-slate-300 mt-0.5">Afastamento: <b class="text-rose-600 dark:text-rose-300">${pTxt}</b></span><span class="block font-extrabold text-sky-700 dark:text-sky-300 mt-1">↳ Retorno: ${formatReturnDateLabel(ret.returnDateKey)} • ${sh.name}${sh.hours ? ` (${sh.hours})` : ''}</span>${skip}`;
    };

    window.setAtestadoUI = function (enabled) {
        modalAtestadoEnabled = Boolean(enabled);
        const ctrl = document.getElementById('atestado-controls');
        if (ctrl) ctrl.classList.toggle('hidden', !modalAtestadoEnabled);
        if (modalAtestadoEnabled) {
            renderAtestadoWhoButtons();
            updateAtestadoPreview();
        }
        syncOccurrenceButtonsUI();
        renderOverrideDetailsUI();
    };

    window.toggleAtestadoMode = function () {
        haptic();
        markModalDirty();
        const next = !modalAtestadoEnabled;
        if (next) {
            currentSelectedOverride = '';
            if (!modalAtestadoStartDate) modalAtestadoStartDate = currentModalDateStr;
        }
        setAtestadoUI(next);
    };

    window.openModal = function (dateKey) {
        haptic();
        upgradeNoteModalDOM();
        currentModalDateStr = dateKey;
        const dt = parseDateKey(dateKey);
        const base = getShift(dt.getFullYear(), dt.getMonth(), dt.getDate(), currentTurma);
        const activeOv = overridesDb[`${dateKey}_${currentTurma}`] || '';
        const activeMeta = getOverrideMeta(dateKey, currentTurma);
        const existingAt = findAtestadoOnDate(dateKey, currentTurma);
        const members = parseTeamMembers(teamNames[currentTurma]);

        let badge = '';
        if (existingAt) {
            const whoInfo = resolveWhoInfo(existingAt.record, currentTurma);
            badge = ` • ATESTADO (${whoInfo.label})`;
        } else if (activeOv && OCC_META[activeOv]) {
            badge = ` • ${OCC_META[activeOv].label.toUpperCase()}`;
        } else if (activeOv && SHIFTS_CONFIG[activeOv]) {
            badge = ` • ${SHIFTS_CONFIG[activeOv].name.toUpperCase()}`;
        }

        const baseCfg = SHIFTS_CONFIG[base] || SHIFTS_CONFIG.M;
        document.getElementById('modal-date-title').innerHTML = `Dia ${dt.getDate()} de ${MONTH_SHORT[dt.getMonth()]} <br><span class="text-[13px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Turno ${TEAM_LETTERS[currentTurma]} • ${escapeHTML(baseCfg.name)}${escapeHTML(badge)}</span>`;
        document.getElementById('note-text').value = getNote(dateKey, currentTurma);

        modalOverrideWho = (activeMeta && activeMeta.whoType) ? String(activeMeta.whoType) : (members.length >= 2 ? '0' : '0');
        modalSwapWith = (activeMeta && activeMeta.swapWith) ? String(activeMeta.swapWith) : '';
        modalSwapWithTeam = (activeMeta && activeMeta.swapWithTeam) ? String(activeMeta.swapWithTeam) : '';
        modalCoveredBy = (activeMeta && activeMeta.coveredBy) ? String(activeMeta.coveredBy) : '';
        modalEntryTime = sanitizeTimeStr(activeMeta && activeMeta.entryTime);
        modalExitTime = sanitizeTimeStr(activeMeta && activeMeta.exitTime);
        modalArrivalTime = sanitizeTimeStr(activeMeta && activeMeta.arrivalTime);

        const originNotice = document.getElementById('atestado-origin-notice');
        if (existingAt) {
            const whoInfo = resolveWhoInfo(existingAt.record, currentTurma);
            modalEditingAtestadoId = existingAt.record.id;
            modalAtestadoStartDate = existingAt.record.startDate;
            modalAtestadoWho = whoInfo.whoType;
            document.getElementById('atestado-days-input').value = existingAt.record.days;
            document.getElementById('atestado-subtitle').innerText = `${whoInfo.label} • ${existingAt.record.days}d`;
            if (existingAt.record.startDate !== dateKey) {
                const startReason = getNote(existingAt.record.startDate, currentTurma);
                originNotice.innerText = `Editando atestado de ${whoInfo.fullLabel} iniciado em ${formatShortDate(existingAt.record.startDate)}.${startReason ? ` Observação: "${startReason}".` : ''} Desmarque Atestado Médico para remover.`;
                originNotice.classList.remove('hidden');
            } else {
                originNotice.classList.add('hidden');
            }
            currentSelectedOverride = '';
            setAtestadoUI(true);
        } else {
            modalEditingAtestadoId = null;
            modalAtestadoStartDate = dateKey;
            modalAtestadoWho = members.length >= 2 ? 'both' : '0';
            document.getElementById('atestado-days-input').value = 1;
            document.getElementById('atestado-subtitle').innerText = '';
            originNotice.classList.add('hidden');
            modalAtestadoEnabled = false;
            currentSelectedOverride = activeOv;
            setAtestadoUI(false);
        }

        modalDirty = false;
        document.getElementById('unsaved-guard')?.classList.add('hidden');
        openAnimatedModal('note', 'note-modal', 'modal-content');
    };

    window.saveNote = function (isClear = false) {
        const v = document.getElementById('note-text').value.trim();
        setNote(currentModalDateStr, currentTurma, v);
        let toastMsg = isClear ? 'Registro do dia limpo!' : 'Alterações salvas!';
        const ovKey = `${currentModalDateStr}_${currentTurma}`;

        if (modalAtestadoEnabled) {
            const days = Math.max(1, Math.min(180, parseInt(document.getElementById('atestado-days-input').value, 10) || 1));
            const startDate = modalAtestadoStartDate || currentModalDateStr;
            const who = getSelectionWhoInfo(modalAtestadoWho, currentTurma);
            const newRec = {
                id: modalEditingAtestadoId || `at_${Date.now()}`,
                turma: currentTurma,
                startDate,
                days,
                whoType: who.whoType,
                whoName: who.whoName
            };
            const newDates = new Set(getAtestadoDates(newRec));
            atestadosDb = atestadosDb.filter(r => r.id !== modalEditingAtestadoId && (r.turma !== currentTurma || !getAtestadoDates(r).some(d => newDates.has(d))));
            atestadosDb.push(newRec);
            newDates.forEach(d => {
                delete overridesDb[`${d}_${currentTurma}`];
                delete overrideMetaDb[`${d}_${currentTurma}`];
            });
            const ret = computeReturnInfo(startDate, days, currentTurma, newRec.id);
            const retName = (SHIFTS_CONFIG[ret.returnShiftCode] || SHIFTS_CONFIG.M).name;
            toastMsg = `Atestado (${who.label}) salvo! Retorno: ${formatShortDate(ret.returnDateKey)} (${retName})`;
        } else {
            if (modalEditingAtestadoId) {
                atestadosDb = atestadosDb.filter(r => r.id !== modalEditingAtestadoId);
                toastMsg = isClear ? 'Atestado e registro do dia removidos.' : 'Atestado removido da escala.';
            }
            if (currentSelectedOverride) {
                overridesDb[ovKey] = currentSelectedOverride;
                const meta = OCC_META[currentSelectedOverride];
                if (meta && meta.hasWho) {
                    const who = getSelectionWhoInfo(modalOverrideWho, currentTurma);
                    const cleanSwap = String(modalSwapWith || '').trim().slice(0, 40);
                    const cleanCover = String(modalCoveredBy || '').trim().slice(0, 40);
                    const entryInp = sanitizeTimeStr(document.getElementById('occ-time-entry')?.value) || sanitizeTimeStr(modalEntryTime);
                    const exitInp = sanitizeTimeStr(document.getElementById('occ-time-exit')?.value) || sanitizeTimeStr(modalExitTime);
                    const arrivalInp = sanitizeTimeStr(document.getElementById('occ-time-arrival')?.value) || sanitizeTimeStr(modalArrivalTime);

                    overrideMetaDb[ovKey] = {
                        whoType: who.whoType,
                        whoName: who.whoName,
                        swapWith: meta.isSwap ? cleanSwap : '',
                        swapWithTeam: meta.isSwap && cleanSwap ? String(modalSwapWithTeam || '').trim().slice(0, 2) : '',
                        coveredBy: meta.canCover ? cleanCover : '',
                        entryTime: meta.timeFields.includes('entry') ? entryInp : '',
                        exitTime: meta.timeFields.includes('exit') ? exitInp : '',
                        arrivalTime: meta.timeFields.includes('arrival') ? arrivalInp : ''
                    };
                } else {
                    delete overrideMetaDb[ovKey];
                }
            } else {
                delete overridesDb[ovKey];
                delete overrideMetaDb[ovKey];
            }
        }

        const ok = DB.flushAll();
        closeModal();
        renderApp(false);
        updateStorageHealthUI();
        showToast(ok ? toastMsg : 'Aviso: salvamento bloqueado! Use o Backup.');
    };

    window.deleteNote = function () {
        document.getElementById('note-text').value = '';
        currentSelectedOverride = '';
        modalSwapWith = '';
        modalSwapWithTeam = '';
        modalCoveredBy = '';
        modalEntryTime = '';
        modalExitTime = '';
        modalArrivalTime = '';
        modalAtestadoEnabled = false;
        saveNote(true);
    };

    /* 6. RENDERIZAÇÃO DA ESCALA GERAL E CARD UNIFICADO NA PÁGINA PRINCIPAL */
    window.renderApp = function (shouldScrollToday = false, swapDirection = 0) {
        try {
            sanitizeAllState();
            ensureOccurrencesSectionDOM();

            const sc = document.getElementById('table-scroll-wrap');
            const tableEl = document.getElementById('main-table');
            const prevScroll = sc ? sc.scrollLeft : 0;
            const year = currentDate.getFullYear(), month = currentDate.getMonth();
            const monthKey = `${year}-${month}`;
            const daysInMonth = new Date(year, month + 1, 0).getDate(), today = new Date();
            const isCMonth = today.getFullYear() === year && today.getMonth() === month;

            const isTeamOrMonthChange = (lastRenderedTurma !== currentTurma) || (lastRenderedMonthKey !== monthKey);
            lastRenderedTurma = currentTurma;
            lastRenderedMonthKey = monthKey;

            document.getElementById('current-month-display').innerText = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            document.getElementById('btn-today')?.classList.toggle('hidden', isCMonth);

            document.querySelectorAll('.team-btn').forEach((btn, i) => {
                const act = i === currentTurma;
                btn.className = `team-btn p-2 lg:py-2.5 rounded-xl border flex flex-col items-center justify-center btn-smooth active:scale-95 min-w-0 cursor-pointer lg:min-h-[64px] ${act ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-md' : 'border-slate-200 dark:border-surfaceBorder bg-slate-50 hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 text-slate-800 dark:text-slate-100'}`;
                const descEl = document.getElementById(`team-desc-${i}`);
                if (descEl) descEl.innerText = teamNames[i];
            });

            const returnDateMap = {}, atestadoDayMap = {};
            atestadosDb.filter(r => r.turma === currentTurma).sort((a, b) => a.startDate.localeCompare(b.startDate)).forEach(rec => {
                const dates = getAtestadoDates(rec);
                const whoInfo = resolveWhoInfo(rec, currentTurma);
                dates.forEach((d, idx) => {
                    atestadoDayMap[d] = { record: rec, whoInfo, dayIndex: idx + 1, totalDays: dates.length, endDate: dates[dates.length - 1] };
                });
                const retInfo = computeReturnInfo(rec.startDate, rec.days, currentTurma, rec.id);
                returnDateMap[retInfo.returnDateKey] = { rec, whoInfo, retInfo };
            });

            const holidays = getHolidays(year, month);
            const dayMeta = [];
            const hListParts = [];
            const counts = { M: 0, T: 0, N: 0, F: 0 };

            const headerCells = ['<th class="sticky-col bg-slate-100 dark:bg-surface p-2 md:px-4 md:py-2.5 border-r border-slate-200 dark:border-surfaceBorder min-w-[126px] max-w-[144px] md:min-w-[162px] md:max-w-[180px] text-left pl-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-xs font-black uppercase text-slate-600 dark:text-slate-300">Turnos</th>'];
            const mmStr = String(month + 1).padStart(2, '0');
            for (let day = 1; day <= daysInMonth; day++) {
                const isToday = isCMonth && day === today.getDate();
                const holi = holidays[day] || '';
                const dow = new Date(year, month, day, 12, 0, 0).getDay();
                const isSunday = dow === 0;
                const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
                dayMeta.push({ day, dateKey, isToday, holi, dow });

                const dayColor = holi ? 'text-red-600 dark:text-red-400' : (isToday ? 'text-blue-600 dark:text-blue-400' : (isSunday ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'));
                if (holi) hListParts.push(`<div class="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-surfaceBorder last:border-0 last:pb-0"><span class="font-black text-red-500 dark:text-red-400 text-sm min-w-[22px] text-right tabular-nums">${day}</span><span class="text-slate-700 dark:text-slate-300 font-medium text-sm leading-tight">${escapeHTML(holi)}</span></div>`);
                const todayHeaderStyle = isToday ? 'bg-blue-100/75 dark:bg-blue-950/60 border-b-2 border-b-blue-500' : '';
                const holiTitle = holi ? ` title="${escapeHTML(`Dia ${day}/${mmStr} • Feriado: ${holi}`)}"` : '';
                headerCells.push(`<th ${isToday ? 'id="col-today"' : ''}${holiTitle} class="p-1.5 md:py-2 md:px-0.5 min-w-[44px] xl:min-w-[38px] border-r border-slate-200 dark:border-surfaceBorder last:border-r-0 ${todayHeaderStyle}"><div class="flex flex-col items-center"><span class="text-[13px] font-black leading-tight tabular-nums ${dayColor}">${day}</span><span class="text-[9px] font-bold ${isSunday || holi || isToday ? 'opacity-95' : 'opacity-60'} ${dayColor}">${DOW_NAMES[dow]}</span></div></th>`);
            }

            const bodyRows = [];
            const seenMainAtIds = new Set();
            const mainPageItems = [];

            TEAM_LETTERS.forEach((teamLtr, idx) => {
                const isSel = idx === currentTurma, rowBg = isSel ? 'bg-white dark:bg-oled' : 'bg-slate-50 dark:bg-surface';
                const safeName = escapeHTML(teamNames[idx]);
                const cells = [`<td data-action="team" data-team="${idx}" class="sticky-col p-2 pl-3 md:px-4 md:py-2.5 border-r border-slate-200 dark:border-surfaceBorder align-middle text-left max-w-[144px] md:max-w-[180px] ${rowBg} cursor-pointer shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] hover:bg-slate-100/70 dark:hover:bg-zinc-900/60 transition-colors"><div class="flex flex-col items-start justify-center min-w-0"><span class="font-black text-sm leading-tight ${isSel ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}">Turno ${teamLtr}</span><span class="text-[9px] md:text-[10px] font-semibold truncate w-full max-w-[116px] md:max-w-[148px] ${isSel ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}" title="${safeName}">${safeName}</span></div></td>`];

                for (let i = 0; i < dayMeta.length; i++) {
                    const { day, dateKey, isToday, holi, dow } = dayMeta[i];
                    const baseShift = getShift(year, month, day, idx);
                    const baseCfg = SHIFTS_CONFIG[baseShift] || SHIFTS_CONFIG.M;

                    if (isSel) {
                        const ovShift = overridesDb[`${dateKey}_${idx}`] || '';
                        const ovMeta = getOverrideMeta(dateKey, idx);
                        const atInfo = atestadoDayMap[dateKey];
                        const retEntry = (!atInfo && returnDateMap[dateKey]) ? returnDateMap[dateKey] : null;
                        const dayNote = getNote(dateKey, idx).trim();
                        const noteDot = dayNote ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 bg-slate-900 dark:bg-white rounded-full"></span>' : '';

                        let code = baseShift;
                        let style = baseCfg.style;
                        let ring = '';
                        let sub = '';
                        let badgeDot = '';
                        const tipParts = [`Dia ${String(day).padStart(2, '0')}/${mmStr} • Turno ${teamLtr} (${teamNames[idx]})`];

                        let itemCardCls = 'occ-card-note';
                        let itemPillCls = 'occ-pill-note';
                        let itemPillTxt = 'Observação';
                        let itemTitle = '';
                        let itemDetail = '';
                        let itemObs = dayNote;
                        let itemOpenDate = dateKey;
                        let shouldPushCard = false;

                        if (atInfo) {
                            code = 'AT';
                            style = SHIFTS_CONFIG.AT.style;
                            sub = `<span class="text-[7px] font-black leading-none mt-0.5 truncate max-w-[40px] opacity-95">${escapeHTML(atInfo.whoInfo.shortLabel)}</span><span class="text-[7px] font-extrabold leading-none opacity-75 tabular-nums">${atInfo.dayIndex}/${atInfo.totalDays}</span>`;
                            tipParts.push(`Atestado Médico (${atInfo.dayIndex}/${atInfo.totalDays}) • ${atInfo.whoInfo.fullLabel}`);

                            if (!seenMainAtIds.has(atInfo.record.id)) {
                                seenMainAtIds.add(atInfo.record.id);
                                const retInfo = computeReturnInfo(atInfo.record.startDate, atInfo.record.days, idx, atInfo.record.id);
                                const retCfg = SHIFTS_CONFIG[retInfo.returnShiftCode] || SHIFTS_CONFIG.M;
                                const pLbl = atInfo.record.days === 1
                                    ? `${formatShortDate(atInfo.record.startDate)} (1 dia)`
                                    : `${formatShortDate(atInfo.record.startDate)} a ${formatShortDate(retInfo.endDate)} (${atInfo.record.days} dias)`;
                                const rStr = `${formatReturnDateLabel(retInfo.returnDateKey)} • ${retCfg.name}${retCfg.hours ? ` (${retCfg.hours})` : ''}`;
                                const skipTxt = retInfo.skippedFolgas > 0 ? ` • Emenda ${retInfo.skippedFolgas} folga(s)` : '';
                                itemCardCls = 'occ-card-at';
                                itemPillCls = 'occ-pill-at';
                                itemPillTxt = `Atestado • ${atInfo.whoInfo.fullLabel}`;
                                itemTitle = pLbl;
                                itemDetail = `↳ Retorno: ${rStr}${skipTxt}`;
                                itemObs = getAtestadoReason(atInfo.record) || dayNote;
                                itemOpenDate = atInfo.record.startDate;
                                shouldPushCard = true;
                            }
                        } else if (ovShift && OCC_META[ovShift]) {
                            const m = OCC_META[ovShift];
                            if (ovShift === 'F') counts.F++;
                            else if (ovShift === 'FA') { /* Falta não soma como dia trabalhado nem folga */ }
                            else counts[baseShift]++;

                            const det = buildOccurrenceDetailSummary(ovShift, ovMeta, baseCfg);

                            if (ovShift === 'FA') {
                                code = 'FA';
                                style = SHIFTS_CONFIG.FA.style;
                                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                                sub = `<span class="text-[7px] font-black leading-none mt-0.5 truncate max-w-[40px] opacity-95">${escapeHTML(who.shortLabel)}</span>`;
                                tipParts.push(`Falta • ${who.fullLabel} • ${det.summary}`);
                                itemCardCls = m.cardCls;
                                itemPillCls = m.pillCls;
                                itemPillTxt = `${m.label} • ${who.fullLabel}`;
                                itemTitle = det.coveredBy ? `Cobertura: ${det.coveredBy}` : '';
                                itemDetail = '';
                                shouldPushCard = true;
                            } else if (ovShift === 'F') {
                                code = 'F';
                                style = SHIFTS_CONFIG.F.style;
                                if (baseShift !== 'F') {
                                    ring = m.ring;
                                    badgeDot = `<span class="absolute top-1 left-1 w-1.5 h-1.5 ${m.dot} rounded-full"></span>`;
                                    tipParts.push(`Folga (Alterado de ${baseCfg.name})`);
                                    itemCardCls = m.cardCls;
                                    itemPillCls = m.pillCls;
                                    itemPillTxt = `${m.label} • Alterado`;
                                    itemTitle = `Era ${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''}`;
                                    shouldPushCard = true;
                                } else {
                                    tipParts.push('Folga');
                                }
                            } else if (m.isSwap) {
                                const swap = formatSwapDisplay(ovMeta, idx);
                                ring = m.ring;
                                badgeDot = `<span class="absolute top-1 left-1 w-1.5 h-1.5 ${m.dot} rounded-full"></span>`;
                                sub = `<span class="text-[6.5px] font-black leading-none text-purple-700 dark:text-purple-300 mt-0.5 truncate max-w-[40px]">${escapeHTML(swap.compactLabel)}</span>`;
                                tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''} • Troca: ${swap.pairLabel}${det.coveredBy ? ` • Cobertura: ${det.coveredBy}` : ''}`);
                                itemCardCls = m.cardCls;
                                itemPillCls = m.pillCls;
                                itemPillTxt = `${m.label} • ${swap.pairLabel}`;
                                itemTitle = det.coveredBy ? `Cobertura: ${det.coveredBy}` : '';
                                itemDetail = '';
                                shouldPushCard = true;
                            } else {
                                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                                ring = m.ring;
                                badgeDot = `<span class="absolute top-1 left-1 w-1.5 h-1.5 ${m.dot} rounded-full"></span>`;
                                const line1 = det.compact || m.code;
                                sub = `<span class="text-[6.5px] font-black leading-none mt-0.5 truncate max-w-[40px] opacity-95 tabular-nums">${escapeHTML(line1)}</span><span class="text-[6.5px] font-extrabold leading-none opacity-85 truncate max-w-[40px]">${escapeHTML(who.shortLabel)}</span>`;
                                tipParts.push(`${m.label} (${who.fullLabel}) • ${det.summary}`);
                                itemCardCls = m.cardCls;
                                itemPillCls = m.pillCls;
                                itemPillTxt = `${m.label} • ${who.fullLabel}`;
                                itemTitle = det.timeSummary;
                                itemDetail = det.coveredBy ? `Cobertura: ${det.coveredBy}` : '';
                                shouldPushCard = true;
                            }
                        } else if (ovShift === 'M' || ovShift === 'T' || ovShift === 'N') {
                            code = ovShift;
                            style = SHIFTS_CONFIG[ovShift].style;
                            counts[ovShift]++;
                            ring = 'ring-2 ring-inset ring-amber-400 dark:ring-amber-500';
                            badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>';
                            tipParts.push(`${SHIFTS_CONFIG[ovShift].name} (${SHIFTS_CONFIG[ovShift].hours}) • Hora Extra`);
                            itemCardCls = 'occ-card-he';
                            itemPillCls = 'occ-pill-he';
                            itemPillTxt = `Hora Extra • ${SHIFTS_CONFIG[ovShift].name}`;
                            itemTitle = SHIFTS_CONFIG[ovShift].hours;
                            itemDetail = '';
                            shouldPushCard = true;
                        } else {
                            counts[baseShift]++;
                            tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''}`);
                        }

                        if (dayNote) {
                            shouldPushCard = true;
                            if (!ovShift && !atInfo) {
                                itemCardCls = 'occ-card-note';
                                itemPillCls = 'occ-pill-note';
                                itemPillTxt = 'Observação';
                                itemTitle = '';
                            }
                        }

                        if (retEntry) {
                            if (!ring) ring = 'ring-2 ring-inset ring-sky-500 dark:ring-sky-400';
                            if (!sub) sub = '<span class="text-[7px] font-black uppercase tracking-tight text-sky-700 dark:text-sky-300 leading-none mt-0.5">Volta</span>';
                            tipParts.push(`Dia de retorno ao trabalho (${retEntry.whoInfo.fullLabel})`);
                        }
                        if (holi) tipParts.push(`Feriado: ${holi}`);
                        if (dayNote) tipParts.push(`Obs: ${dayNote}`);

                        if (shouldPushCard) {
                            mainPageItems.push({
                                dateKey: itemOpenDate,
                                dateStr: `${String(day).padStart(2, '0')}/${mmStr}`,
                                dowPretty: DOW_PRETTY[dow],
                                isRedDay: Boolean(dow === 0 || holi),
                                cardCls: itemCardCls,
                                pillCls: itemPillCls,
                                pillTxt: itemPillTxt,
                                title: itemTitle,
                                detail: itemDetail,
                                obs: itemObs
                            });
                        }

                        cells.push(`<td data-action="note" data-date="${dateKey}" data-day="${day}" title="${escapeHTML(tipParts.join('\n'))}" class="p-0.5 border-r border-slate-200 dark:border-surfaceBorder last:border-r-0 relative text-center text-sm ${style} ${ring} cursor-pointer cell-smooth cell-active active:scale-95"><div class="w-full h-full flex flex-col items-center justify-center min-h-[46px] md:min-h-[52px] px-0.5"><span class="leading-none">${code}</span>${sub}${badgeDot}${noteDot}</div></td>`);
                    } else {
                        const ovOther = overridesDb[`${dateKey}_${idx}`] || '';
                        const ovOtherMeta = getOverrideMeta(dateKey, idx);
                        const dim = baseShift === 'F' ? 'text-green-600/65 dark:text-green-400/60 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium opacity-55';
                        let otherDot = '';
                        let extraTip = '';
                        if (ovOther && OCC_META[ovOther]) {
                            otherDot = `<span class="absolute top-1 left-1 w-1.5 h-1.5 ${OCC_META[ovOther].dot} opacity-80 rounded-full"></span>`;
                            extraTip = ovOther === 'TD'
                                ? ` • Troca: ${formatSwapDisplay(ovOtherMeta, idx).pairLabel}`
                                : ` • ${OCC_META[ovOther].label}`;
                        }
                        const tip = `Dia ${String(day).padStart(2, '0')}/${mmStr} • Turno ${teamLtr} (${teamNames[idx]}) • ${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''}${extraTip} • Clique para destacar`;
                        cells.push(`<td data-action="team" data-team="${idx}" title="${escapeHTML(tip)}" class="p-0.5 border-r border-slate-200 dark:border-surfaceBorder last:border-r-0 relative text-center text-sm cursor-pointer cell-smooth hover:opacity-90 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20 ' : ''}${dim}"><div class="w-full h-full flex items-center justify-center min-h-[46px] md:min-h-[52px]">${baseShift}${otherDot}</div></td>`);
                    }
                }
                bodyRows.push(`<tr class="${rowBg} border-b border-slate-200 dark:border-surfaceBorder last:border-b-0">${cells.join('')}</tr>`);
            });

            tableEl.innerHTML = `<thead><tr class="bg-slate-100 dark:bg-surfaceBorder/40 border-b border-slate-200 dark:border-surfaceBorder">${headerCells.join('')}</tr></thead><tbody>${bodyRows.join('')}</tbody>`;
            if (swapDirection && isTeamOrMonthChange) animateTableSwap(tableEl, swapDirection);

            ['M', 'T', 'N', 'F'].forEach(k => updateCountAnimated(k, counts[k]));

            const occSec = document.getElementById('occurrences-summary-section');
            const occCont = document.getElementById('occurrences-summary-container');
            const occBadge = document.getElementById('occurrences-summary-badge');
            const occTitle = document.getElementById('occurrences-summary-title');
            const hasOccs = mainPageItems.length > 0;

            if (occSec && occCont) {
                if (occTitle) {
                    occTitle.lastElementChild.innerText = `Observações & Ocorrências • Turno ${TEAM_LETTERS[currentTurma]}`;
                }
                if (hasOccs) {
                    if (occBadge) {
                        occBadge.innerText = `${mainPageItems.length} ${mainPageItems.length === 1 ? 'registro' : 'registros'}`;
                    }
                    occCont.innerHTML = mainPageItems.map(it => {
                        const dateCls = it.isRedDay ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100';
                        const titleHTML = it.title
                            ? `<div class="mt-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-300 tabular-nums">${escapeHTML(it.title)}</div>`
                            : '';
                        const detailHTML = it.detail
                            ? `<div class="mt-2 rounded-xl bg-sky-50/90 dark:bg-sky-950/35 border border-sky-200/80 dark:border-sky-900/50 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHTML(it.detail)}</div>`
                            : '';
                        const obsHTML = it.obs
                            ? `<div class="mt-2 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200/80 dark:border-surfaceBorder px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug break-words whitespace-pre-wrap">${escapeHTML(it.obs)}</div>`
                            : '';
                        return `<div class="occ-card ${it.cardCls} shadow-sm">
                            <div class="flex items-center justify-between gap-2 flex-wrap">
                                <div class="flex items-center gap-2 flex-wrap min-w-0">
                                    <span class="text-xs font-black tabular-nums ${dateCls}">${it.dateStr} (${it.dowPretty})</span>
                                    <span class="occ-pill ${it.pillCls}">${escapeHTML(it.pillTxt)}</span>
                                </div>
                                <button type="button" onclick="openModal('${it.dateKey}')" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer">Editar &gt;</button>
                            </div>
                            ${titleHTML}
                            ${detailHTML}
                            ${obsHTML}
                        </div>`;
                    }).join('');
                    occSec.classList.remove('hidden');
                } else {
                    occCont.innerHTML = '';
                    occSec.classList.add('hidden');
                }
            }

            const hEl = document.getElementById('holidays-list');
            const hasHolidays = hListParts.length > 0;
            if (hEl) {
                if (hasHolidays) {
                    document.getElementById('holidays-container').innerHTML = hListParts.join('');
                    hEl.classList.remove('hidden');
                } else {
                    hEl.classList.add('hidden');
                }
            }

            const grid = document.getElementById('bottom-cards-grid');
            if (grid && occSec && hEl) {
                grid.classList.toggle('hidden', !hasOccs && !hasHolidays);
                if (hasOccs && hasHolidays) {
                    occSec.classList.remove('lg:col-span-2');
                    hEl.classList.remove('lg:col-span-2');
                    occCont.className = 'grid grid-cols-1 md:grid-cols-2 gap-2.5';
                } else {
                    occSec.classList.toggle('lg:col-span-2', hasOccs);
                    hEl.classList.toggle('lg:col-span-2', hasHolidays);
                    occCont.className = hasOccs ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5' : 'space-y-2.5';
                }
            }

            if (shouldScrollToday && isCMonth) scrollToTodayColumn();
            else if (sc) sc.scrollLeft = prevScroll;
            requestAnimationFrame(updateTableScrollHint);
        } catch (err) {
            console.error('Erro ao renderizar:', err);
            showToast('Erro ao carregar a visualização.');
        }
    };

    /* 7. QUADRO A4 HORIZONTAL (OPERADORES) */
    window.buildA4Dataset = function () {
        sanitizeAllState();
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        const mmStr = String(month + 1).padStart(2, '0');
        const holidaysMap = getHolidays(year, month);

        const days = [];
        const holidaysList = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dow = new Date(year, month, day, 12, 0, 0).getDay();
            const holi = holidaysMap[day] || '';
            const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
            days.push({ day, dow, dowLabel: DOW_NAMES[dow], isSunday: dow === 0, holiday: holi, dateKey });
            if (holi) holidaysList.push({ day, dateStr: `${String(day).padStart(2, '0')}/${mmStr}`, dowPretty: DOW_PRETTY[dow], name: holi });
        }

        const teams = TEAM_LETTERS.map((letter, idx) => {
            const counts = { M: 0, T: 0, N: 0, F: 0 };
            const cells = days.map(({ day }) => {
                const base = getShift(year, month, day, idx);
                counts[base]++;
                return { code: base, pal: base, sub: '', whoShort: '', cls: '' };
            });
            return { letter, idx, name: teamNames[idx], cells, counts };
        });

        const issued = new Date();
        const issuedStr = `${String(issued.getDate()).padStart(2, '0')}/${String(issued.getMonth() + 1).padStart(2, '0')}/${issued.getFullYear()} às ${String(issued.getHours()).padStart(2, '0')}:${String(issued.getMinutes()).padStart(2, '0')}`;
        return { year, month, mmStr, daysInMonth, monthLabel, days, holidaysList, teams, issuedStr };
    };

    window.buildA4SheetHTML = function (data) {
        const headDaysHTML = data.days.map(d => {
            const cls = d.holiday ? ' is-holi' : (d.isSunday ? ' is-sun' : '');
            return `<th class="a4-th-day${cls}"><span class="a4-day-num">${String(d.day).padStart(2, '0')}</span><span class="a4-day-dow">${d.dowLabel}</span></th>`;
        }).join('');

        const rowsHTML = data.teams.map(t => {
            const cellsHTML = t.cells.map(c => `<td class="a4-cell a4-cell-${c.pal}"><span>${c.code}</span></td>`).join('');
            return `<tr><td class="a4-td-team"><div class="a4-team-title"><span class="a4-team-badge">${t.letter}</span><span>Turno ${t.letter}</span></div><span class="a4-team-names">${escapeHTML(t.name)}</span></td>${cellsHTML}</tr>`;
        }).join('');

        const summaryRowsHTML = data.teams.map(t => (
            `<tr><td><strong>Turno ${t.letter}</strong><span class="a4-sum-sub">${escapeHTML(t.name)}</span></td><td style="color:#1e40af">${t.counts.M}</td><td style="color:#9a3412">${t.counts.T}</td><td style="color:#3730a3">${t.counts.N}</td><td style="color:#15803d">${t.counts.F}</td></tr>`
        )).join('');

        const holidaysHTML = data.holidaysList.length
            ? `<div class="a4-holi-list">${data.holidaysList.map(h => `<div class="a4-holi-row"><span class="a4-holi-date">${h.dateStr} (${h.dowPretty})</span><span class="a4-holi-name">${escapeHTML(h.name)}</span></div>`).join('')}</div>`
            : `<div class="a4-holi-empty">Nenhum feriado nacional, estadual ou municipal neste mês.</div>`;

        return `<div class="a4-sheet">
            <div class="a4-header">
                <div class="a4-brand">
                    <img class="a4-logo" src="${IMERYS_SVG_URI}" alt="Imerys">
                    <div>
                        <h2 class="a4-title">ESCALA GERAL DE REVEZAMENTO 3×1</h2>
                        <div class="a4-subtitle">IMERYS • BRITAGEM ICP 1 • QUADRO DE AVISOS DOS TURNOS</div>
                    </div>
                </div>
                <div class="a4-period-box">
                    <span class="a4-month-pill">${escapeHTML(data.monthLabel)}</span>
                    <span class="a4-cycle-note">Revezamento Contínuo • 4 Equipes (A, B, C e D) • ${data.daysInMonth} dias</span>
                </div>
            </div>

            <div class="a4-table-wrap">
                <table class="a4-table">
                    <thead><tr><th class="a4-th-team">Turnos / Equipes</th>${headDaysHTML}</tr></thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>

            <div class="a4-bottom-grid">
                <div class="a4-card">
                    <div class="a4-card-title">Legenda dos Turnos</div>
                    <div class="a4-legend-list">
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-M">M</span><span class="a4-legend-name">Manhã</span></div><span class="a4-legend-hours">05:00 às 13:00</span></div>
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-T">T</span><span class="a4-legend-name">Tarde</span></div><span class="a4-legend-hours">13:00 às 21:00</span></div>
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-N">N</span><span class="a4-legend-name">Noite</span></div><span class="a4-legend-hours">21:00 às 05:00</span></div>
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-F">F</span><span class="a4-legend-name">Folga</span></div><span class="a4-legend-hours">Descanso</span></div>
                    </div>
                    <div class="a4-legend-extra"><span><strong style="color:#dc2626">■</strong> Dom./Feriado</span></div>
                </div>

                <div class="a4-card">
                    <div class="a4-card-title">Resumo Mensal por Turno</div>
                    <table class="a4-summary-table">
                        <thead><tr><th>Turno / Equipe</th><th>M</th><th>T</th><th>N</th><th>F</th></tr></thead>
                        <tbody>${summaryRowsHTML}</tbody>
                    </table>
                </div>

                <div class="a4-card">
                    <div class="a4-card-title">Feriados do Mês (Nacional / ES / Cachoeiro)</div>
                    ${holidaysHTML}
                </div>
            </div>

            <div class="a4-footer">
                <span>Imerys • Britagem ICP 1 • Escala Oficial para Quadro dos Operadores</span>
                <span>Emitido em ${data.issuedStr} • Formato A4 Horizontal</span>
            </div>
        </div>`;
    };

    async function downloadQuadroA4PNG() {
        haptic();
        showToast('Gerando imagem A4 HD...');
        const data = buildA4Dataset();

        const W = 2338, H = 1654;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const font = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const padX = 58, padTop = 50, contentW = W - padX * 2;
        const logoImg = await loadLogoImage();
        const logoSize = 114;
        canvasRoundRect(ctx, padX, padTop, logoSize, logoSize, 22);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3; ctx.stroke();
        if (logoImg) {
            ctx.save();
            canvasRoundRect(ctx, padX + 3, padTop + 3, logoSize - 6, logoSize - 6, 19);
            ctx.clip();
            ctx.drawImage(logoImg, padX + 3, padTop + 3, logoSize - 6, logoSize - 6);
            ctx.restore();
        }

        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a'; ctx.font = `900 48px ${font}`;
        ctx.fillText('ESCALA GERAL DE REVEZAMENTO 3×1', padX + logoSize + 28, padTop + 12);
        ctx.fillStyle = '#475569'; ctx.font = `800 22px ${font}`;
        ctx.fillText('IMERYS • BRITAGEM ICP 1 • QUADRO DE AVISOS DOS TURNOS', padX + logoSize + 28, padTop + 74);

        ctx.font = `900 40px ${font}`;
        const pillW = Math.max(360, ctx.measureText(data.monthLabel).width + 76), pillH = 68;
        const pillX = W - padX - pillW, pillY = padTop + 4;
        canvasRoundRect(ctx, pillX, pillY, pillW, pillH, 18);
        ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(data.monthLabel, pillX + pillW / 2, pillY + pillH / 2 + 1);

        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#475569'; ctx.font = `700 21px ${font}`;
        ctx.fillText(`Revezamento Contínuo • 4 Equipes (A, B, C e D) • ${data.daysInMonth} dias`, W - padX, pillY + pillH + 14);

        const headerBottomY = padTop + logoSize + 24;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, headerBottomY, contentW, 5);

        const tblX = padX, tblY = headerBottomY + 26;
        const teamColW = 330;
        const dayColW = (contentW - teamColW) / data.daysInMonth;
        const headRowH = 92, teamRowH = 142;
        const tblH = headRowH + teamRowH * 4;

        ctx.save();
        canvasRoundRect(ctx, tblX, tblY, contentW, tblH, 18);
        ctx.clip();

        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(tblX, tblY, teamColW, headRowH);
        ctx.fillStyle = '#0f172a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = `900 22px ${font}`;
        ctx.fillText('TURNOS / EQUIPES', tblX + 22, tblY + headRowH / 2);

        data.days.forEach((d, i) => {
            const x = tblX + teamColW + i * dayColW;
            ctx.fillStyle = d.holiday ? '#fee2e2' : (d.isSunday ? '#fef2f2' : '#f8fafc');
            ctx.fillRect(x, tblY, dayColW, headRowH);
            if (d.holiday) { ctx.fillStyle = '#dc2626'; ctx.fillRect(x, tblY, dayColW, 7); }
            const txtColor = d.holiday ? '#b91c1c' : (d.isSunday ? '#dc2626' : '#0f172a');
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = txtColor; ctx.font = `900 27px ${font}`;
            ctx.fillText(String(d.day).padStart(2, '0'), x + dayColW / 2, tblY + 34);
            ctx.fillStyle = (d.holiday || d.isSunday) ? txtColor : '#64748b'; ctx.font = `800 16px ${font}`;
            ctx.fillText(d.dowLabel, x + dayColW / 2, tblY + 67);
        });

        data.teams.forEach((t, rowIdx) => {
            const y = tblY + headRowH + rowIdx * teamRowH;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(tblX, y, teamColW, teamRowH);

            canvasRoundRect(ctx, tblX + 22, y + 32, 42, 42, 11);
            ctx.fillStyle = '#0f172a'; ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `900 23px ${font}`;
            ctx.fillText(t.letter, tblX + 43, y + 54);

            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a'; ctx.font = `900 30px ${font}`;
            ctx.fillText(`Turno ${t.letter}`, tblX + 76, y + 54);
            ctx.fillStyle = '#475569'; ctx.font = `700 21px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, t.name, teamColW - 44), tblX + 22, y + 102);

            t.cells.forEach((cell, cIdx) => {
                const x = tblX + teamColW + cIdx * dayColW;
                const p = PALETTE[cell.pal] || PALETTE.F;
                ctx.fillStyle = p.bg;
                ctx.fillRect(x, y, dayColW, teamRowH);
                ctx.fillStyle = p.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.font = `900 31px ${font}`;
                ctx.fillText(cell.code, x + dayColW / 2, y + teamRowH / 2);
            });
        });

        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
        for (let i = 1; i < data.daysInMonth; i++) {
            const x = tblX + teamColW + i * dayColW;
            ctx.beginPath(); ctx.moveTo(x, tblY); ctx.lineTo(x, tblY + tblH); ctx.stroke();
        }
        for (let r = 1; r < 4; r++) {
            const y = tblY + headRowH + r * teamRowH;
            ctx.beginPath(); ctx.moveTo(tblX, y); ctx.lineTo(tblX + contentW, y); ctx.stroke();
        }
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(tblX + teamColW, tblY); ctx.lineTo(tblX + teamColW, tblY + tblH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tblX, tblY + headRowH); ctx.lineTo(tblX + contentW, tblY + headRowH); ctx.stroke();
        ctx.restore();

        canvasRoundRect(ctx, tblX, tblY, contentW, tblH, 18);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 3.5; ctx.stroke();

        const cardsY = tblY + tblH + 30;
        const footerH = 54;
        const cardsH = H - cardsY - footerH - 36;
        const gap = 28;
        const w1 = Math.round((contentW - gap * 2) * 0.305);
        const w2 = Math.round((contentW - gap * 2) * 0.375);
        const w3 = contentW - gap * 2 - w1 - w2;
        const x1 = padX, x2 = x1 + w1 + gap, x3 = x2 + w2 + gap;

        const drawCardBox = (x, w, title) => {
            canvasRoundRect(ctx, x, cardsY, w, cardsH, 18);
            ctx.fillStyle = '#f8fafc'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#334155'; ctx.font = `900 20px ${font}`;
            ctx.fillText(title, x + 26, cardsY + 22);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x + 26, cardsY + 56, w - 52, 2);
        };

        drawCardBox(x1, w1, 'LEGENDA DOS TURNOS');
        [
            { code: 'M', name: 'Manhã', hrs: '05:00 às 13:00' },
            { code: 'T', name: 'Tarde', hrs: '13:00 às 21:00' },
            { code: 'N', name: 'Noite', hrs: '21:00 às 05:00' },
            { code: 'F', name: 'Folga', hrs: 'Descanso' }
        ].forEach((lr, idx) => {
            const ry = cardsY + 74 + idx * 80;
            const p = PALETTE[lr.code];
            canvasRoundRect(ctx, x1 + 26, ry, w1 - 52, 66, 13);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.stroke();
            canvasRoundRect(ctx, x1 + 40, ry + 11, 48, 44, 10);
            ctx.fillStyle = p.bg; ctx.fill();
            ctx.fillStyle = p.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `900 23px ${font}`;
            ctx.fillText(lr.code, x1 + 64, ry + 34);
            ctx.textAlign = 'left'; ctx.fillStyle = '#0f172a'; ctx.font = `800 24px ${font}`;
            ctx.fillText(lr.name, x1 + 104, ry + 34);
            ctx.textAlign = 'right'; ctx.fillStyle = '#334155'; ctx.font = `800 22px ${font}`;
            ctx.fillText(lr.hrs, x1 + w1 - 44, ry + 34);
        });
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#334155'; ctx.font = `800 16px ${font}`;
        ctx.fillText('■ Dom./Feriado', x1 + 26, cardsY + cardsH - 18);

        drawCardBox(x2, w2, 'RESUMO MENSAL POR TURNO');
        const stX = x2 + 26, stY = cardsY + 74, stW = w2 - 52, stH = cardsH - 96;
        const stHeadH = 54, stRowH = (stH - stHeadH) / 4;
        const sumHeaders = ['M', 'T', 'N', 'F'];
        const numColW = 74;
        const nameColW = Math.max(150, stW - sumHeaders.length * numColW);

        ctx.save();
        canvasRoundRect(ctx, stX, stY, stW, stH, 13);
        ctx.clip();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(stX, stY, stW, stHeadH);
        ctx.fillStyle = '#334155'; ctx.font = `900 18px ${font}`; ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText('TURNO / EQUIPE', stX + 16, stY + stHeadH / 2);
        ctx.textAlign = 'center';
        sumHeaders.forEach((sh, si) => ctx.fillText(sh, stX + nameColW + si * numColW + numColW / 2, stY + stHeadH / 2));

        data.teams.forEach((t, ti) => {
            const ry = stY + stHeadH + ti * stRowH;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(stX, ry, stW, stRowH);
            if (ti > 0) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(stX, ry, stW, 2); }
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a'; ctx.font = `900 22px ${font}`;
            ctx.fillText(`Turno ${t.letter}`, stX + 16, ry + stRowH * 0.34);
            ctx.fillStyle = '#64748b'; ctx.font = `600 17px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, t.name, nameColW - 22), stX + 16, ry + stRowH * 0.72);

            const vals = [
                { v: t.counts.M, c: '#1e40af' },
                { v: t.counts.T, c: '#9a3412' },
                { v: t.counts.N, c: '#3730a3' },
                { v: t.counts.F, c: '#15803d' }
            ];
            ctx.textAlign = 'center'; ctx.font = `900 22px ${font}`;
            vals.forEach((item, vi) => {
                ctx.fillStyle = item.c;
                ctx.fillText(String(item.v), stX + nameColW + vi * numColW + numColW / 2, ry + stRowH / 2);
            });
        });
        ctx.restore();
        canvasRoundRect(ctx, stX, stY, stW, stH, 13);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();

        drawCardBox(x3, w3, 'FERIADOS DO MÊS (NACIONAL / ES / CACHOEIRO)');
        if (data.holidaysList.length === 0) {
            canvasRoundRect(ctx, x3 + 26, cardsY + 130, w3 - 52, 120, 14);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.setLineDash([8, 6]); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `700 22px ${font}`;
            ctx.fillText('Nenhum feriado previsto neste mês.', x3 + w3 / 2, cardsY + 190);
        } else {
            const maxShow = Math.min(data.holidaysList.length, 6);
            const rowStep = Math.min(68, Math.floor((cardsH - 96) / Math.max(1, maxShow)));
            const itemH = Math.max(46, rowStep - 10);
            for (let hi = 0; hi < maxShow; hi++) {
                const h = data.holidaysList[hi];
                const ry = cardsY + 74 + hi * rowStep;
                canvasRoundRect(ctx, x3 + 26, ry, w3 - 52, itemH, 10);
                ctx.fillStyle = '#ffffff'; ctx.fill();
                ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(x3 + 26, ry + 3, 7, itemH - 6);
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#b91c1c'; ctx.font = `900 21px ${font}`;
                const dLbl = `${h.dateStr} (${h.dowPretty})`;
                ctx.fillText(dLbl, x3 + 46, ry + itemH / 2);
                const dW = ctx.measureText(dLbl).width;
                ctx.fillStyle = '#1e293b'; ctx.font = `700 21px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, h.name, w3 - 106 - dW), x3 + 60 + dW, ry + itemH / 2);
            }
        }

        const footY = H - 54;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(padX, footY - 14, contentW, 2);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#64748b'; ctx.font = `700 19px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText('Imerys • Britagem ICP 1 • Escala Oficial para Quadro dos Operadores', padX, footY);
        ctx.textAlign = 'right';
        ctx.fillText(`Emitido em ${data.issuedStr} • Formato A4 Horizontal (HD)`, W - padX, footY);

        const fileName = `Escala_Imerys_A4_${data.mmStr}_${data.year}.png`;
        c.toBlob((blob) => {
            if (!blob) { showToast('Não foi possível gerar a imagem.'); return; }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.setAttribute('download', fileName);
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 1500);
            showToast('Imagem A4 HD baixada com sucesso!');
        }, 'image/png');
    }

    /* 8. RELATÓRIO DE OCORRÊNCIAS MENSAIS (ENCARREGADO & SUPERVISOR) */
    function buildSupervisorDataset(teamFilter, sortMode, categoryFilter = 'all') {
        sanitizeAllState();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        const mmStr = String(month + 1).padStart(2, '0');
        const holidaysMap = getHolidays(year, month);
        const targetTeams = teamFilter === 'all' ? [0, 1, 2, 3] : [parseInt(teamFilter, 10)];

        const atByTeam = [{}, {}, {}, {}];
        for (let idx = 0; idx < 4; idx++) {
            atestadosDb.filter(r => r.turma === idx).forEach(rec => {
                const whoInfo = resolveWhoInfo(rec, idx);
                const retInfo = computeReturnInfo(rec.startDate, rec.days, idx, rec.id);
                const dates = getAtestadoDates(rec);
                dates.forEach((d, pos) => {
                    atByTeam[idx][d] = {
                        record: rec, whoInfo, retInfo,
                        dayIndex: pos + 1, totalDays: dates.length
                    };
                });
            });
        }

        const allEntries = [];
        const perTeamFiltered = [0, 0, 0, 0];
        const perTeamAll = [0, 0, 0, 0];
        const uniqueDaysSet = new Set();
        const seenAtestadoIds = new Set();

        const breakdown = {
            he: 0, at: 0, fa: 0, td: 0, ea: 0, sa: 0, dm: 0, ep: 0, noteOnly: 0, total: 0
        };

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
            const dow = new Date(year, month, day, 12, 0, 0).getDay();
            const isSunday = dow === 0;
            const holiday = holidaysMap[day] || '';

            for (let idx = 0; idx < 4; idx++) {
                const rawNote = getNote(dateKey, idx).trim();
                const ovShift = overridesDb[`${dateKey}_${idx}`] || '';
                const ovMeta = getOverrideMeta(dateKey, idx);
                const atInfo = atByTeam[idx][dateKey] || null;

                let includeEntry = false;
                let displayNote = rawNote;

                if (atInfo) {
                    if (!seenAtestadoIds.has(atInfo.record.id)) {
                        seenAtestadoIds.add(atInfo.record.id);
                        includeEntry = true;
                        displayNote = getAtestadoReason(atInfo.record) || rawNote;
                    } else if (rawNote && rawNote !== getNote(atInfo.record.startDate, idx).trim()) {
                        includeEntry = true;
                        displayNote = rawNote;
                    }
                } else if (rawNote || ovShift) {
                    includeEntry = true;
                }

                if (!includeEntry) continue;
                perTeamAll[idx]++;
                if (!targetTeams.includes(idx)) continue;

                const baseShift = getShift(year, month, day, idx);
                const baseCfg = SHIFTS_CONFIG[baseShift] || SHIFTS_CONFIG.M;

                let chipCode = baseShift;
                let chipPaletteKey = baseShift;
                let reasonText = `${baseCfg.name} (Sem ocorrência)`;
                let subText = baseCfg.hours ? `Horário: ${baseCfg.hours}` : 'Descanso';
                let filterGroup = 'other';

                if (atInfo) {
                    breakdown.at++;
                    breakdown.total++;
                    filterGroup = 'at';
                    const retCfg = SHIFTS_CONFIG[atInfo.retInfo.returnShiftCode] || SHIFTS_CONFIG.M;
                    chipCode = 'AT';
                    chipPaletteKey = 'AT';
                    reasonText = `Atestado Médico — ${atInfo.whoInfo.fullLabel}`;
                    subText = `Duração: ${atInfo.totalDays} ${atInfo.totalDays === 1 ? 'dia' : 'dias'} • Volta: ${formatShortDate(atInfo.retInfo.returnDateKey)} (${retCfg.name})`;
                } else if (ovShift && OCC_META[ovShift]) {
                    const m = OCC_META[ovShift];
                    const det = buildOccurrenceDetailSummary(ovShift, ovMeta, baseCfg);
                    breakdown.total++;
                    filterGroup = m.filterGroup;

                    if (m.countKey === 'he') breakdown.he++;
                    else if (m.countKey === 'fa') breakdown.fa++;
                    else if (m.countKey === 'td') breakdown.td++;
                    else if (m.countKey === 'ea') breakdown.ea++;
                    else if (m.countKey === 'sa') breakdown.sa++;
                    else if (m.countKey === 'dm') breakdown.dm++;
                    else if (m.countKey === 'ep') breakdown.ep++;
                    else breakdown.noteOnly++;

                    chipCode = m.chip;
                    chipPaletteKey = m.palette;
                    if (ovShift === 'F') {
                        reasonText = baseShift !== 'F' ? `Folga (Alterado de ${baseCfg.name})` : 'Folga';
                        subText = det.coveredBy ? `Cobertura: ${det.coveredBy}` : 'Descanso';
                    } else if (m.isSwap) {
                        const swap = formatSwapDisplay(ovMeta, idx);
                        reasonText = `${m.label} — ${swap.pairLabel}`;
                        subText = det.summary;
                    } else {
                        const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                        reasonText = `${m.label} — ${who.fullLabel}`;
                        subText = det.summary;
                    }
                } else if (ovShift === 'M' || ovShift === 'T' || ovShift === 'N') {
                    breakdown.he++;
                    breakdown.total++;
                    filterGroup = 'he';
                    const ovCfg = SHIFTS_CONFIG[ovShift];
                    chipCode = ovShift;
                    chipPaletteKey = 'HE';
                    reasonText = `Hora Extra (${ovCfg.name})`;
                    subText = `Horário: ${ovCfg.hours}`;
                } else {
                    breakdown.noteOnly++;
                    breakdown.total++;
                    filterGroup = 'other';
                    reasonText = `Observação de Escala (${baseCfg.name})`;
                    subText = baseCfg.hours ? `Horário: ${baseCfg.hours}` : 'Descanso';
                }

                perTeamFiltered[idx]++;
                uniqueDaysSet.add(day);
                allEntries.push({
                    day, dateKey,
                    dateStr: `${String(day).padStart(2, '0')}/${mmStr}`,
                    dowPretty: DOW_PRETTY[dow],
                    isSunday, holiday,
                    turmaIdx: idx,
                    letter: TEAM_LETTERS[idx],
                    teamName: teamNames[idx],
                    chipCode, chipPaletteKey, filterGroup,
                    reasonText, subText,
                    text: displayNote
                });
            }
        }

        const entries = categoryFilter === 'all'
            ? allEntries
            : allEntries.filter(e => e.filterGroup === categoryFilter);

        if (sortMode === 'team') entries.sort((a, b) => (a.turmaIdx - b.turmaIdx) || (a.day - b.day));
        else entries.sort((a, b) => (a.day - b.day) || (a.turmaIdx - b.turmaIdx));

        const catLabels = {
            all: 'Todas as Categorias', he: 'Hora Extra', at: 'Atestados', fa: 'Faltas',
            td: 'Trocas', ea_sa: 'Ent. Atrasada / Saí. Adiantada',
            dm_ep: 'Decl. Médica / Ex. Periódico', other: 'Obs. / Outras'
        };

        const scopeLabel = teamFilter === 'all'
            ? 'Todos os Turnos (A, B, C e D)'
            : `Turno ${TEAM_LETTERS[targetTeams[0]]} (${teamNames[targetTeams[0]]})`;
        const catLabel = catLabels[categoryFilter] || 'Todas as Categorias';
        const sortLabel = sortMode === 'team'
            ? `Agrupado por Turno (A → D) • Dia 1 → ${daysInMonth}`
            : `Ordem Cronológica (Dia 1 → ${daysInMonth})`;

        const issued = new Date();
        const issuedStr = `${String(issued.getDate()).padStart(2, '0')}/${String(issued.getMonth() + 1).padStart(2, '0')}/${issued.getFullYear()} às ${String(issued.getHours()).padStart(2, '0')}:${String(issued.getMinutes()).padStart(2, '0')}`;

        return {
            year, month, mmStr, daysInMonth, monthLabel, teamFilter, categoryFilter, sortMode,
            scopeLabel, catLabel, sortLabel, entries,
            shownCount: entries.length,
            totalAllMonth: perTeamAll.reduce((acc, n) => acc + n, 0),
            uniqueDays: uniqueDaysSet.size,
            perTeam: perTeamFiltered,
            breakdown,
            issuedStr
        };
    }

    function buildSupervisorSheetHTML(data) {
        const b = data.breakdown;
        const catCards = [
            { lbl: 'Hora Extra', val: b.he },
            { lbl: 'Atestados', val: b.at },
            { lbl: 'Faltas', val: b.fa },
            { lbl: 'Trocas', val: b.td },
            { lbl: 'Ent. Atrasada', val: b.ea },
            { lbl: 'Saí. Adiantada', val: b.sa },
            { lbl: 'Decl. Médica', val: b.dm },
            { lbl: 'Ex. Periódico', val: b.ep },
            { lbl: 'Obs. / Outras', val: b.noteOnly }
        ];
        const catHTML = catCards.map(c => (
            `<div class="sup-cat-box"><span class="sup-cat-lbl">${escapeHTML(c.lbl)}</span><span class="sup-cat-num">${c.val}</span></div>`
        )).join('');

        let tableBodyHTML = '';
        if (!data.entries.length) {
            tableBodyHTML = `<tr><td colspan="4" class="sup-empty-box">Nenhuma ocorrência ou observação registrada para o filtro selecionado neste mês.</td></tr>`;
        } else {
            tableBodyHTML = data.entries.map(item => {
                const redCls = (item.isSunday || item.holiday) ? ' sup-is-red' : '';
                const obsHTML = item.text
                    ? `<div class="sup-obs-text">${escapeHTML(item.text)}</div>`
                    : `<div class="sup-obs-text sup-obs-empty">—</div>`;

                return `<tr>
                    <td class="${redCls}">
                        <span class="sup-date-main">${item.dateStr}</span>
                        <span class="sup-date-dow">${item.dowPretty}</span>
                    </td>
                    <td>
                        <div class="sup-team-cell">
                            <span class="sup-team-letter-badge">${item.letter}</span>
                            <span class="sup-team-names">${escapeHTML(item.teamName)}</span>
                        </div>
                    </td>
                    <td>
                        <div class="sup-shift-cell">
                            <span class="sup-shift-chip a4-cell-${item.chipPaletteKey}">${escapeHTML(item.chipCode)}</span>
                            <div>
                                <span class="sup-shift-reason">${escapeHTML(item.reasonText)}</span>
                                <span class="sup-shift-sub">${escapeHTML(item.subText)}</span>
                            </div>
                        </div>
                    </td>
                    <td>${obsHTML}</td>
                </tr>`;
            }).join('');
        }

        const filterNote = data.categoryFilter !== 'all' ? ` • ${data.catLabel}` : '';

        return `<div class="sup-sheet">
            <div class="a4-header">
                <div class="a4-brand">
                    <img class="a4-logo" src="${IMERYS_SVG_URI}" alt="Imerys">
                    <div>
                        <h2 class="a4-title">RELATÓRIO DE OCORRÊNCIAS MENSAIS</h2>
                        <div class="a4-subtitle">IMERYS • BRITAGEM ICP 1 • ENCARREGADO &amp; SUPERVISOR DE BRITAGEM</div>
                    </div>
                </div>
                <div class="a4-period-box">
                    <span class="a4-month-pill">${escapeHTML(data.monthLabel)}</span>
                    <span class="a4-cycle-note">${escapeHTML(data.scopeLabel)}${escapeHTML(filterNote)} • ${escapeHTML(data.sortLabel)}</span>
                </div>
            </div>

            <div class="sup-breakdown-wrap">
                ${catHTML}
                <div class="sup-cat-box is-total">
                    <span class="sup-cat-lbl">Total de Ocorrências</span>
                    <span class="sup-cat-num">${b.total}</span>
                </div>
            </div>

            <div class="sup-meta-row">
                <div class="sup-meta-card">
                    <span class="sup-meta-lbl">Dias com Registro</span>
                    <span class="sup-meta-val">${data.uniqueDays} de ${data.daysInMonth} dias</span>
                </div>
                <div class="sup-meta-card">
                    <span class="sup-meta-lbl">Por Turno</span>
                    <div class="sup-meta-teams">
                        <span>A: <b>${data.perTeam[0]}</b></span>
                        <span>B: <b>${data.perTeam[1]}</b></span>
                        <span>C: <b>${data.perTeam[2]}</b></span>
                        <span>D: <b>${data.perTeam[3]}</b></span>
                    </div>
                </div>
            </div>

            <div class="sup-table-wrap">
                <table class="sup-table">
                    <thead>
                        <tr>
                            <th class="sup-col-date">Data</th>
                            <th class="sup-col-team">Turno / Equipe</th>
                            <th class="sup-col-occ">Ocorrência</th>
                            <th>Observação Registrada</th>
                        </tr>
                    </thead>
                    <tbody>${tableBodyHTML}</tbody>
                </table>
            </div>

            <div class="sup-sign-grid">
                <div class="sup-sign-box"><div class="sup-sign-line">Encarregado de Britagem</div></div>
                <div class="sup-sign-box"><div class="sup-sign-line">Supervisor de Britagem</div></div>
                <div class="sup-sign-box"><div class="sup-sign-line">Data de Fechamento</div></div>
            </div>

            <div class="a4-footer">
                <span>Imerys • Britagem ICP 1 • Relatório de Ocorrências Mensais</span>
                <span>Emitido em ${data.issuedStr} • Formato A4 Horizontal</span>
            </div>
        </div>`;
    }

    function syncExportModeUI(supData) {
        const isSup = exportMode === 'supervisor';
        const pill = document.getElementById('export-mode-pill');
        const title = document.getElementById('export-modal-title');
        const sub = document.getElementById('export-modal-subtitle');
        const caption = document.getElementById('export-preview-caption');
        const tabQuadro = document.getElementById('export-tab-quadro');
        const tabSup = document.getElementById('export-tab-supervisor');
        const tabBadge = document.getElementById('sup-tab-badge');
        const supOpts = document.getElementById('export-supervisor-options');
        const printLbl = document.getElementById('export-print-btn-label');
        const pngLbl = document.getElementById('export-png-btn-label');
        const copyBtn = document.getElementById('sup-copy-btn');
        const countPill = document.getElementById('sup-count-pill');
        const sortDateBtn = document.getElementById('sup-sort-date-btn');

        const activeTabCls = 'py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer bg-white dark:bg-surface text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-surfaceBorder';
        const idleTabCls = 'py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 btn-smooth cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent';

        if (tabQuadro) tabQuadro.className = isSup ? idleTabCls : activeTabCls;
        if (tabSup) tabSup.className = isSup ? activeTabCls : idleTabCls;
        if (tabBadge && supData) {
            tabBadge.innerText = String(supData.totalAllMonth);
            tabBadge.className = isSup
                ? 'px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums bg-blue-600 text-white shrink-0'
                : 'px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums bg-slate-200 dark:bg-surfaceBorder text-slate-700 dark:text-slate-200 shrink-0';
        }
        if (sortDateBtn && supData) sortDateBtn.innerText = `Por Data (1 → ${supData.daysInMonth})`;

        if (pill) {
            pill.innerText = 'Gerar / Imprimir Relatório';
            pill.className = isSup
                ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-200/70 dark:border-indigo-900/50 mb-1.5'
                : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-200/70 dark:border-blue-900/50 mb-1.5';
        }
        if (title) title.innerText = 'Gerar / Imprimir Relatório';
        if (sub) sub.innerText = isSup
            ? 'Relatório de ocorrências mensais para encarregado e supervisor.'
            : 'Escala oficial dos 4 turnos, horários, totais e feriados em A4 horizontal.';
        if (caption) caption.innerText = isSup
            ? 'Prévia do Relatório de Ocorrências Mensais (A4 Paisagem)'
            : 'Prévia da Folha A4 (Paisagem • 1 Página)';

        supOpts?.classList.toggle('hidden', !isSup);
        copyBtn?.classList.toggle('hidden', !isSup);
        if (printLbl) printLbl.innerText = isSup ? 'Imprimir / PDF Relatório' : 'Imprimir / Salvar PDF (A4)';
        if (pngLbl) pngLbl.innerText = isSup ? 'Baixar Relatório HD (.PNG)' : 'Baixar Imagem A4 HD (.PNG)';

        if (countPill && supData) {
            const n = supData.shownCount;
            countPill.innerText = `${n} ${n === 1 ? 'registro' : 'registros'}`;
        }

        document.querySelectorAll('.sup-filter-btn').forEach(btn => {
            const act = btn.getAttribute('data-sup-team') === String(supTeamFilter);
            btn.className = `sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer ${act
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300'}`;
        });
        document.querySelectorAll('.sup-cat-btn').forEach(btn => {
            const act = btn.getAttribute('data-sup-cat') === supCategoryFilter;
            btn.className = `sup-cat-btn py-1 px-2.5 rounded-lg text-[10.5px] font-extrabold border btn-smooth cursor-pointer ${act
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300'}`;
        });
        document.querySelectorAll('.sup-sort-btn').forEach(btn => {
            const act = btn.getAttribute('data-sup-sort') === supSortMode;
            btn.className = `sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer ${act
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300'}`;
        });
    }

    function applyScaledPreview() {
        const frame = document.getElementById('a4-preview-frame');
        const spacer = document.getElementById('a4-preview-spacer');
        const scaler = document.getElementById('a4-preview-scaler');
        if (!frame || !scaler) return;
        const isSup = exportMode === 'supervisor';
        frame.classList.toggle('is-sup-preview', isSup);
        const w = frame.clientWidth;
        if (w <= 0) return;
        const scale = w / 1122;
        scaler.style.transform = `scale(${scale})`;
        if (spacer) {
            const naturalH = isSup ? Math.max(793, scaler.scrollHeight || 793) : 793;
            spacer.style.height = `${Math.ceil(naturalH * scale)}px`;
        }
    }

    function refreshAllExportOutputs() {
        upgradeExportModalDOM();
        const supData = buildSupervisorDataset(supTeamFilter, supSortMode, supCategoryFilter);
        syncExportModeUI(supData);

        const printEl = document.getElementById('print-sheet');
        const scaler = document.getElementById('a4-preview-scaler');
        const badge = document.getElementById('export-month-badge');

        if (exportMode === 'supervisor') {
            const html = buildSupervisorSheetHTML(supData);
            if (printEl) { printEl.classList.add('is-supervisor-print'); printEl.innerHTML = html; }
            if (scaler) scaler.innerHTML = html;
            if (badge) badge.innerText = supData.monthLabel;
            requestAnimationFrame(applyScaledPreview);
            return supData;
        } else {
            const quadroData = buildA4Dataset();
            const html = buildA4SheetHTML(quadroData);
            if (printEl) { printEl.classList.remove('is-supervisor-print'); printEl.innerHTML = html; }
            if (scaler) scaler.innerHTML = html;
            if (badge) badge.innerText = quadroData.monthLabel;
            requestAnimationFrame(applyScaledPreview);
            return quadroData;
        }
    }

    function wrapCanvasLines(ctx, text, maxW) {
        const result = [];
        const paragraphs = String(text || '').split(/\r?\n/);
        paragraphs.forEach(para => {
            if (!para.trim()) { result.push(''); return; }
            const words = para.split(/\s+/);
            let line = '';
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width <= maxW) {
                    line = test;
                } else {
                    if (line) { result.push(line); line = ''; }
                    if (ctx.measureText(word).width <= maxW) {
                        line = word;
                    } else {
                        let chunk = '';
                        for (let ch of word) {
                            if (ctx.measureText(chunk + ch).width > maxW && chunk) { result.push(chunk); chunk = ch; }
                            else chunk += ch;
                        }
                        line = chunk;
                    }
                }
            }
            if (line) result.push(line);
        });
        return result.length ? result : [''];
    }

    async function downloadSupervisorPNG() {
        haptic();
        showToast('Gerando Relatório HD...');
        const data = buildSupervisorDataset(supTeamFilter, supSortMode, supCategoryFilter);
        const b = data.breakdown;
        const W = 2338;
        const font = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        const padX = 58, padTop = 50, contentW = W - padX * 2;
        const colDateW = 186, colTeamW = 392, colShiftW = 582;
        const colObsW = contentW - colDateW - colTeamW - colShiftW;

        const mCanvas = document.createElement('canvas');
        const mCtx = mCanvas.getContext('2d');
        mCtx.font = `600 24px ${font}`;
        const measuredRows = data.entries.map(item => {
            const lines = item.text ? wrapCanvasLines(mCtx, item.text, colObsW - 44) : ['—'];
            const textH = lines.length * 34;
            const rowH = Math.max(106, textH + 44);
            return { item, lines, rowH };
        });

        const headerBottomY = padTop + 114 + 24;
        const catY = headerBottomY + 24, catH = 104;
        const metaY = catY + catH + 16, metaH = 62;
        const tblY = metaY + metaH + 22, tblHeadH = 68;
        const rowsTotalH = measuredRows.length ? measuredRows.reduce((acc, r) => acc + r.rowH, 0) : 260;
        const signBlockH = 136, footerBlockH = 74;
        const neededH = tblY + tblHeadH + rowsTotalH + signBlockH + footerBlockH + 44;
        const H = Math.max(1654, neededH);

        const MAX_PIXELS = 15500000;
        const pixelScale = (W * H > MAX_PIXELS) ? Math.sqrt(MAX_PIXELS / (W * H)) : 1;

        const c = document.createElement('canvas');
        c.width = Math.floor(W * pixelScale);
        c.height = Math.floor(H * pixelScale);
        const ctx = c.getContext('2d');
        if (pixelScale < 1) ctx.scale(pixelScale, pixelScale);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const logoImg = await loadLogoImage();
        const logoSize = 114;
        canvasRoundRect(ctx, padX, padTop, logoSize, logoSize, 22);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3; ctx.stroke();
        if (logoImg) {
            ctx.save();
            canvasRoundRect(ctx, padX + 3, padTop + 3, logoSize - 6, logoSize - 6, 19);
            ctx.clip();
            ctx.drawImage(logoImg, padX + 3, padTop + 3, logoSize - 6, logoSize - 6);
            ctx.restore();
        }

        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a'; ctx.font = `900 45px ${font}`;
        ctx.fillText('RELATÓRIO DE OCORRÊNCIAS MENSAIS', padX + logoSize + 28, padTop + 12);
        ctx.fillStyle = '#475569'; ctx.font = `800 22px ${font}`;
        ctx.fillText('IMERYS • BRITAGEM ICP 1 • ENCARREGADO & SUPERVISOR DE BRITAGEM', padX + logoSize + 28, padTop + 74);

        ctx.font = `900 40px ${font}`;
        const pillW = Math.max(360, ctx.measureText(data.monthLabel).width + 76), pillH = 68;
        const pillX = W - padX - pillW, pillY = padTop + 4;
        canvasRoundRect(ctx, pillX, pillY, pillW, pillH, 18);
        ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(data.monthLabel, pillX + pillW / 2, pillY + pillH / 2 + 1);

        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#475569'; ctx.font = `700 20px ${font}`;
        const subMetaStr = `${data.scopeLabel}${data.categoryFilter !== 'all' ? ` • ${data.catLabel}` : ''} • ${data.sortLabel}`;
        ctx.fillText(canvasTruncateText(ctx, subMetaStr, 960), W - padX, pillY + pillH + 14);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, headerBottomY, contentW, 5);

        const boxGap = 12;
        const totalBoxW = 280;
        const eachBoxW = Math.floor((contentW - totalBoxW - boxGap * 5) / 5);
        const catItems = [
            { lbl: 'HORA EXTRA', val: b.he },
            { lbl: 'ATESTADOS', val: b.at },
            { lbl: 'FALTAS', val: b.fa },
            { lbl: 'TROCAS', val: b.td },
            { lbl: 'ENT. ATRASADA', val: b.ea },
            { lbl: 'SAÍ. ADIANTADA', val: b.sa },
            { lbl: 'DECL. MÉDICA', val: b.dm },
            { lbl: 'EX. PERIÓDICO', val: b.ep },
            { lbl: 'OBS. / OUTRAS', val: b.noteOnly }
        ];

        const topRow = catItems.slice(0, 5);
        const botRow = catItems.slice(5);
        const halfH = Math.floor((catH - 10) / 2);

        topRow.forEach((item, idx) => {
            const bx = padX + idx * (eachBoxW + boxGap);
            canvasRoundRect(ctx, bx, catY, eachBoxW, halfH, 11);
            ctx.fillStyle = '#f8fafc'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#475569'; ctx.font = `900 14px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, item.lbl, eachBoxW - 70), bx + 12, catY + halfH / 2);
            ctx.textAlign = 'right'; ctx.fillStyle = '#0f172a'; ctx.font = `900 24px ${font}`;
            ctx.fillText(String(item.val), bx + eachBoxW - 12, catY + halfH / 2);
        });

        const botY = catY + halfH + 10;
        const botEachW = Math.floor((contentW - totalBoxW - boxGap * 4) / 4);
        botRow.forEach((item, idx) => {
            const bx = padX + idx * (botEachW + boxGap);
            canvasRoundRect(ctx, bx, botY, botEachW, halfH, 11);
            ctx.fillStyle = '#f8fafc'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#475569'; ctx.font = `900 14px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, item.lbl, botEachW - 70), bx + 12, botY + halfH / 2);
            ctx.textAlign = 'right'; ctx.fillStyle = '#0f172a'; ctx.font = `900 24px ${font}`;
            ctx.fillText(String(item.val), bx + botEachW - 12, botY + halfH / 2);
        });

        const totX = W - padX - totalBoxW;
        canvasRoundRect(ctx, totX, catY, totalBoxW, catH, 14);
        ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#cbd5e1'; ctx.font = `900 15px ${font}`;
        ctx.fillText('TOTAL DE OCORRÊNCIAS', totX + 18, catY + 15);
        ctx.fillStyle = '#ffffff'; ctx.font = `900 42px ${font}`;
        ctx.fillText(String(b.total), totX + 18, catY + 44);

        const leftMetaW = Math.floor((contentW - 18) * 0.36);
        const rightMetaW = contentW - 18 - leftMetaW;
        const rightMetaX = padX + leftMetaW + 18;

        canvasRoundRect(ctx, padX, metaY, leftMetaW, metaH, 12);
        ctx.fillStyle = '#f8fafc'; ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#64748b'; ctx.font = `800 16px ${font}`;
        ctx.fillText('DIAS COM REGISTRO', padX + 18, metaY + metaH / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#0f172a'; ctx.font = `900 22px ${font}`;
        ctx.fillText(`${data.uniqueDays} de ${data.daysInMonth} dias`, padX + leftMetaW - 18, metaY + metaH / 2);

        canvasRoundRect(ctx, rightMetaX, metaY, rightMetaW, metaH, 12);
        ctx.fillStyle = '#f8fafc'; ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#64748b'; ctx.font = `800 16px ${font}`;
        ctx.fillText('POR TURNO', rightMetaX + 18, metaY + metaH / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#0f172a'; ctx.font = `900 21px ${font}`;
        ctx.fillText(`A: ${data.perTeam[0]}   •   B: ${data.perTeam[1]}   •   C: ${data.perTeam[2]}   •   D: ${data.perTeam[3]}`, rightMetaX + rightMetaW - 18, metaY + metaH / 2);

        const colX0 = padX;
        const colX1 = colX0 + colDateW;
        const colX2 = colX1 + colTeamW;
        const colX3 = colX2 + colShiftW;
        const tblTotalH = tblHeadH + rowsTotalH;

        ctx.save();
        canvasRoundRect(ctx, padX, tblY, contentW, tblTotalH, 16);
        ctx.clip();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, tblY, contentW, tblHeadH);
        ctx.fillStyle = '#ffffff'; ctx.font = `900 20px ${font}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const thMidY = tblY + tblHeadH / 2 + 1;
        ctx.fillText('DATA', colX0 + 22, thMidY);
        ctx.fillText('TURNO / EQUIPE', colX1 + 22, thMidY);
        ctx.fillText('OCORRÊNCIA', colX2 + 22, thMidY);
        ctx.fillText('OBSERVAÇÃO REGISTRADA', colX3 + 22, thMidY);

        let curY = tblY + tblHeadH;
        if (!measuredRows.length) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(padX, curY, contentW, 260);
            ctx.fillStyle = '#64748b'; ctx.font = `700 26px ${font}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Nenhuma ocorrência ou observação registrada para o filtro selecionado neste mês.', padX + contentW / 2, curY + 130);
            curY += 260;
        } else {
            measuredRows.forEach((row, rIdx) => {
                const { item, lines, rowH } = row;
                ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                ctx.fillRect(padX, curY, contentW, rowH);

                ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(padX, curY); ctx.lineTo(padX + contentW, curY);
                [colX1, colX2, colX3].forEach(vx => { ctx.moveTo(vx, curY); ctx.lineTo(vx, curY + rowH); });
                ctx.stroke();

                const isRed = item.isSunday || Boolean(item.holiday);
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = isRed ? '#dc2626' : '#0f172a'; ctx.font = `900 28px ${font}`;
                ctx.fillText(item.dateStr, colX0 + 22, curY + 22);
                ctx.fillStyle = isRed ? '#ef4444' : '#64748b'; ctx.font = `800 19px ${font}`;
                ctx.fillText(item.dowPretty.toUpperCase(), colX0 + 22, curY + 58);

                canvasRoundRect(ctx, colX1 + 22, curY + 24, 44, 44, 10);
                ctx.fillStyle = '#0f172a'; ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.font = `900 24px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(item.letter, colX1 + 44, curY + 46);

                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#0f172a'; ctx.font = `800 22px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.teamName, colTeamW - 96), colX1 + 78, curY + 46);

                const pal = PALETTE[item.chipPaletteKey] || PALETTE.M;
                const chipW = item.chipCode.length >= 4 ? 76 : 62;
                canvasRoundRect(ctx, colX2 + 22, curY + 22, chipW, 42, 10);
                ctx.fillStyle = pal.bg; ctx.fill();
                ctx.fillStyle = pal.fg; ctx.font = `900 20px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(item.chipCode, colX2 + 22 + chipW / 2, curY + 43);

                const shiftTxtX = colX2 + 22 + chipW + 14;
                const shiftMaxW = colShiftW - (chipW + 46);
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#0f172a'; ctx.font = `900 21px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.reasonText, shiftMaxW), shiftTxtX, curY + 20);
                ctx.fillStyle = '#475569'; ctx.font = `700 18px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.subText, shiftMaxW), shiftTxtX, curY + 50);

                ctx.fillStyle = item.text ? '#0f172a' : '#94a3b8';
                ctx.font = `600 24px ${font}`;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                lines.forEach((ln, li) => {
                    ctx.fillText(ln, colX3 + 22, curY + 22 + li * 34);
                });

                curY += rowH;
            });
        }
        ctx.restore();

        canvasRoundRect(ctx, padX, tblY, contentW, tblTotalH, 16);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.stroke();

        const signY = Math.max(curY + 34, H - footerBlockH - signBlockH);
        const signGap = 56;
        const signW = (contentW - signGap * 2) / 3;
        ['Encarregado de Britagem', 'Supervisor de Britagem', 'Data de Fechamento'].forEach((lbl, idx) => {
            const sx = padX + idx * (signW + signGap);
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(sx, signY + 62);
            ctx.lineTo(sx + signW, signY + 62);
            ctx.stroke();
            ctx.fillStyle = '#334155'; ctx.font = `800 19px ${font}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(lbl, sx + signW / 2, signY + 74);
        });

        const footY = H - 54;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(padX, footY - 14, contentW, 2);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#64748b'; ctx.font = `700 19px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText('Imerys • Britagem ICP 1 • Relatório de Ocorrências Mensais', padX, footY);
        ctx.textAlign = 'right';
        ctx.fillText(`Emitido em ${data.issuedStr} • Formato A4 Horizontal (HD)`, W - padX, footY);

        const suffix = data.teamFilter === 'all' ? 'Todos' : `Turno_${TEAM_LETTERS[parseInt(data.teamFilter, 10)]}`;
        const fileName = `Relatorio_Ocorrencias_Mensais_${suffix}_${data.mmStr}_${data.year}.png`;
        const triggerDl = (href, isBlob) => {
            const a = document.createElement('a');
            a.href = href; a.setAttribute('download', fileName);
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            if (isBlob) setTimeout(() => window.URL.revokeObjectURL(href), 2500);
            showToast('Relatório HD (.PNG) baixado!');
        };

        if (typeof c.toBlob === 'function') {
            c.toBlob((blob) => {
                if (blob) triggerDl(window.URL.createObjectURL(blob), true);
                else { try { triggerDl(c.toDataURL('image/png'), false); } catch (e) { showToast('Não foi possível gerar a imagem.'); } }
            }, 'image/png');
        } else {
            try { triggerDl(c.toDataURL('image/png'), false); } catch (e) { showToast('Não foi possível gerar a imagem.'); }
        }
    }

    function copyTextFallback(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    async function copySupervisorSummary() {
        haptic();
        const data = buildSupervisorDataset(supTeamFilter, supSortMode, supCategoryFilter);
        const b = data.breakdown;
        const lines = [
            `*RELATÓRIO DE OCORRÊNCIAS MENSAIS*`,
            `Imerys • Britagem ICP 1`,
            `Período: *${data.monthLabel}*`,
            `Escopo: ${data.scopeLabel}${data.categoryFilter !== 'all' ? ` • ${data.catLabel}` : ''} | ${data.sortLabel}`,
            `Hora Extra: ${b.he} • Atestados: ${b.at} • Faltas: ${b.fa} • Trocas: ${b.td} • Ent. Atrasada: ${b.ea} • Saí. Adiantada: ${b.sa} • Decl. Médica: ${b.dm} • Ex. Periódico: ${b.ep} • Obs./Outras: ${b.noteOnly}`,
            `*Total de Ocorrências: ${b.total}* (em ${data.uniqueDays} de ${data.daysInMonth} dias)`,
            `Por turno: A (${data.perTeam[0]}) • B (${data.perTeam[1]}) • C (${data.perTeam[2]}) • D (${data.perTeam[3]})`,
            `----------------------------------------`
        ];

        if (!data.entries.length) {
            lines.push('Nenhuma ocorrência ou observação registrada para o filtro selecionado neste mês.');
        } else {
            data.entries.forEach(item => {
                lines.push(`• *${item.dateStr} (${item.dowPretty})* — *${item.letter}* (${item.teamName}) — ${item.reasonText} [${item.subText}]`);
                if (item.text) lines.push(`  ${item.text.replace(/\r?\n/g, '\n  ')}`);
            });
        }
        lines.push(`----------------------------------------`);
        lines.push(`Emitido em ${data.issuedStr}`);

        const payload = lines.join('\n');
        if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
            try {
                await navigator.share({ title: `Relatório de Ocorrências Mensais - ${data.monthLabel}`, text: payload });
                showToast('Relatório compartilhado!');
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }

        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(payload); copied = true; } catch (e) { copied = false; }
        }
        if (!copied) copied = copyTextFallback(payload);
        showToast(copied ? 'Relatório copiado! Cole no WhatsApp ou e-mail.' : 'Não foi possível copiar automaticamente.');
    }

    /* 9. BACKUP JSON */
    window.exportBackup = function () {
        haptic();
        sanitizeAllState();
        const payload = {
            version: 11,
            exportedAt: new Date().toISOString(),
            turma: currentTurma,
            teams: teamNames,
            notes: notesDb,
            overrides: overridesDb,
            overrideMeta: overrideMetaDb,
            atestados: atestadosDb
        };
        const url = window.URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.setAttribute('download', 'Backup_Escala_Imerys.json');
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        showToast('Backup exportado com sucesso!');
    };

    window.importBackup = function (event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const validTurma = (typeof data.turma === 'number' && Number.isInteger(data.turma) && data.turma >= 0 && data.turma <= 3) ? data.turma : currentTurma;
                currentTurma = validTurma;
                if (Array.isArray(data.teams) && data.teams.length === 4) {
                    teamNames = sanitizeTeamList(data.teams);
                }
                if (data.notes && typeof data.notes === 'object' && !Array.isArray(data.notes)) {
                    Object.entries(data.notes).forEach(([k, val]) => {
                        const txt = String(val || '').trim();
                        if (!txt) return;
                        if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k)) notesDb[k] = txt;
                        else if (/^\d{4}-\d{2}-\d{2}$/.test(k)) notesDb[`${k}_${validTurma}`] = txt;
                    });
                }
                if (data.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides)) {
                    Object.entries(data.overrides).forEach(([k, val]) => {
                        if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && VALID_OVERRIDES.includes(val)) overridesDb[k] = val;
                    });
                }
                if (data.overrideMeta && typeof data.overrideMeta === 'object' && !Array.isArray(data.overrideMeta)) {
                    Object.entries(data.overrideMeta).forEach(([k, val]) => {
                        if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && val && typeof val === 'object') {
                            overrideMetaDb[k] = normalizeMetaRecord(val);
                        }
                    });
                }
                if (Array.isArray(data.atestados)) {
                    const byKey = new Map(atestadosDb.map(a => [`${a.startDate}_${a.turma}`, a]));
                    data.atestados.forEach(item => {
                        if (item && /^\d{4}-\d{2}-\d{2}$/.test(item.startDate) && Number.isInteger(item.turma) && item.turma >= 0 && item.turma <= 3 && item.days >= 1) {
                            const wt = ['0', '1', 'both'].includes(String(item.whoType)) ? String(item.whoType) : 'both';
                            byKey.set(`${item.startDate}_${item.turma}`, {
                                id: item.id || `at_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                turma: item.turma,
                                startDate: item.startDate,
                                days: Math.max(1, Math.min(180, parseInt(item.days, 10) || 1)),
                                whoType: wt,
                                whoName: typeof item.whoName === 'string' ? item.whoName.trim().slice(0, 40) : ''
                            });
                        }
                    });
                    atestadosDb = Array.from(byKey.values());
                }
                sanitizeAllState();
                DB.flushAll();
                closeInfoModal();
                renderApp(false);
                updateStorageHealthUI();
                showToast('Backup restaurado com sucesso!');
            } catch (err) {
                showToast('Arquivo de backup inválido.');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    /* 10. INTEGRAÇÃO COM EXPORTAÇÃO, IMPRESSÃO E INICIALIZAÇÃO */
    window.switchExportMode = function (mode) {
        if (mode !== 'quadro' && mode !== 'supervisor') return;
        haptic();
        exportMode = mode;
        refreshAllExportOutputs();
    };
    window.setSupervisorTeamFilter = function (val) {
        haptic();
        supTeamFilter = String(val);
        refreshAllExportOutputs();
    };
    window.setSupervisorCategoryFilter = function (cat) {
        haptic();
        supCategoryFilter = String(cat || 'all');
        refreshAllExportOutputs();
    };
    window.setSupervisorSortMode = function (mode) {
        haptic();
        supSortMode = mode === 'team' ? 'team' : 'date';
        refreshAllExportOutputs();
    };
    window.scaleA4Preview = applyScaledPreview;
    window.refreshA4Outputs = refreshAllExportOutputs;
    window.downloadA4PNG = downloadQuadroA4PNG;
    window.copySupervisorSummary = copySupervisorSummary;

    window.openExportModal = function () {
        haptic();
        upgradeExportModalDOM();
        refreshAllExportOutputs();
        openAnimatedModal('export', 'export-modal', 'export-modal-content', () => applyScaledPreview());
    };

    window.printA4Schedule = function () {
        haptic();
        const data = refreshAllExportOutputs();
        const originalTitle = document.title;
        document.title = exportMode === 'supervisor'
            ? `Relatorio_Ocorrencias_Mensais_${data.mmStr}_${data.year}`
            : `Escala_Imerys_Quadro_A4_${data.mmStr}_${data.year}`;
        const restore = () => { document.title = originalTitle; };
        window.addEventListener('afterprint', restore, { once: true });
        setTimeout(() => { window.print(); setTimeout(restore, 1500); }, 60);
    };

    window.triggerExportPNG = function () {
        if (exportMode === 'supervisor') return downloadSupervisorPNG();
        return downloadQuadroA4PNG();
    };

    function prepareModuleBeforeBoot() {
        checkHostDependencies();
        injectModuleStyles();
        ensureOccurrencesSectionDOM();
        upgradeInfoModalDOM();
        upgradeNoteModalDOM();
        upgradeExportModalDOM();
        upgradeDesktopInlineLegend();
    }

    function bindAfterBoot() {
        window.addEventListener('beforeprint', () => {
            const printEl = document.getElementById('print-sheet');
            if (!printEl) return;
            const exportOpen = !document.getElementById('export-modal')?.classList.contains('hidden');
            if (exportOpen && exportMode === 'supervisor') {
                printEl.classList.add('is-supervisor-print');
                printEl.innerHTML = buildSupervisorSheetHTML(buildSupervisorDataset(supTeamFilter, supSortMode, supCategoryFilter));
            } else {
                printEl.classList.remove('is-supervisor-print');
                printEl.innerHTML = buildA4SheetHTML(buildA4Dataset());
            }
        });
    }

    prepareModuleBeforeBoot();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindAfterBoot();
            renderApp(true);
        }, { once: true });
    } else {
        bindAfterBoot();
        renderApp(true);
    }
})();
