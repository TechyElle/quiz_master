document.addEventListener('DOMContentLoaded', () => {
    const questionsContainer = document.getElementById('questions-container');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const emptyAddQuestionBtn = document.getElementById('empty-add-question-btn');
    const saveExamBtn = document.getElementById('save-exam-btn');
    const saveStatus = document.getElementById('save-status');
    const topicFilterContainer = document.getElementById('topic-filter');
    const emptyState = document.getElementById('empty-state');

    const statQuestionCount = document.getElementById('stat-question-count');
    const statTotalPoints = document.getElementById('stat-total-points');
    const statDuration = document.getElementById('stat-duration');
    const statTopicCount = document.getElementById('stat-topic-count');
    const readinessScore = document.getElementById('readiness-score');
    const readinessNote = document.getElementById('readiness-note');
    const readinessFill = document.getElementById('readiness-fill');
    const readinessChecklist = document.getElementById('readiness-checklist');
    const examPreview = document.getElementById('exam-preview');
    const exportSummary = document.getElementById('export-summary');

    const saveModal = document.getElementById('save-modal');
    const modalCloseEls = saveModal ? saveModal.querySelectorAll('[data-close-modal="true"]') : [];
    const modalRowsEl = document.getElementById('modal-question-rows');
    const modalQuestionCountEl = document.getElementById('modal-question-count');
    const modalTotalPointsEl = document.getElementById('modal-total-points');
    const modalCopyJsonBtn = document.getElementById('modal-copy-json-btn');
    const exportCopyJsonBtn = document.getElementById('export-copy-json-btn');
    const exportOpenModalBtn = document.getElementById('export-open-modal-btn');

    const STORAGE_KEY = 'quizcraft_studio_exam_v1';

    const TOPIC_OPTIONS = [
        { key: 'Programming', dotVar: '--topic-prog' },
        { key: 'Networking', dotVar: '--topic-net' },
        { key: 'Logic Design', dotVar: '--topic-logic' },
        { key: 'Algorithms', dotVar: '--topic-algo' },
        { key: 'Mathematics', dotVar: '--topic-math' },
    ];

    const TYPE_OPTIONS = ['Essay', 'Multiple Choice', 'True/False', 'Problem Set'];
    const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
    const BLOOM_OPTIONS = ['Remember', 'Understand', 'Apply', 'Analyze'];

    const TEMPLATE_SETS = {
        midterm: [
            createQuestionSeed('Explain the role of abstraction in writing maintainable programs.', 'Programming', 'Essay', 8, 'Medium', 'Understand'),
            createQuestionSeed('Which device forwards packets between different networks?', 'Networking', 'Multiple Choice', 2, 'Easy', 'Remember', ['Switch', 'Router', 'Hub', 'Repeater'], 'B'),
            createQuestionSeed('Convert the binary value 101101 to decimal.', 'Logic Design', 'Problem Set', 5, 'Medium', 'Apply'),
            createQuestionSeed('Trace the output of a loop that doubles a value until it reaches 64.', 'Algorithms', 'Problem Set', 6, 'Medium', 'Analyze'),
        ],
        programming: [
            createQuestionSeed('What keyword is commonly used to declare a variable that cannot be reassigned?', 'Programming', 'Multiple Choice', 2, 'Easy', 'Remember', ['let', 'const', 'var', 'static'], 'B'),
            createQuestionSeed('Write a function that returns the largest number in an array.', 'Programming', 'Problem Set', 8, 'Medium', 'Apply'),
            createQuestionSeed('Compare event listeners and inline event attributes in JavaScript.', 'Programming', 'Essay', 6, 'Medium', 'Understand'),
        ],
        problem: [
            createQuestionSeed('Solve for x: 3x + 9 = 24.', 'Mathematics', 'Problem Set', 4, 'Easy', 'Apply'),
            createQuestionSeed('Design a truth table for A AND (B OR C).', 'Logic Design', 'Problem Set', 6, 'Medium', 'Analyze'),
            createQuestionSeed('Determine the time complexity of a nested loop over n items.', 'Algorithms', 'Problem Set', 6, 'Medium', 'Analyze'),
        ],
    };

    let autosaveTimer = null;
    let activeTopic = 'All';
    let activeView = 'build';
    let questions = [];

    function newId() {
        return crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    }

    function createQuestionSeed(text, topic, type, points, difficulty, bloom, options = ['', '', '', ''], answer = '') {
        return { text, topic, type, points, difficulty, bloom, options, answer, note: '' };
    }

    function normalizePoints(v) {
        const n = Number(v);
        if (Number.isNaN(n)) return 0;
        return Math.max(0, Math.floor(n));
    }

    function setSaveState(state, message) {
        if (!saveStatus) return;
        saveStatus.classList.remove('is-saved', 'is-saving');
        if (state === 'saving') saveStatus.classList.add('is-saving');
        if (state === 'saved') saveStatus.classList.add('is-saved');
        if (typeof message === 'string') saveStatus.textContent = message;
    }

    function getTopicDotColor(topicKey) {
        const found = TOPIC_OPTIONS.find(t => t.key === topicKey);
        return found ? `var(${found.dotVar})` : 'var(--topic-default)';
    }

    function createTopicBadgeEl(topicKey) {
        const badge = document.createElement('div');
        badge.className = 'topic-badge';

        const dot = document.createElement('span');
        dot.className = 'topic-pill-dot';
        dot.style.background = getTopicDotColor(topicKey);

        const label = document.createElement('span');
        label.textContent = topicKey;

        badge.appendChild(dot);
        badge.appendChild(label);
        return badge;
    }

    function createSelect(options, value, className = 'select') {
        const select = document.createElement('select');
        select.className = className;
        options.forEach(optionValue => {
            const opt = document.createElement('option');
            opt.value = optionValue;
            opt.textContent = optionValue;
            if (value === optionValue) opt.selected = true;
            select.appendChild(opt);
        });
        return select;
    }

    function createMetaField(labelText, control) {
        const field = document.createElement('div');
        field.className = 'meta-field';

        const label = document.createElement('div');
        label.className = 'meta-label';
        label.textContent = labelText;

        field.appendChild(label);
        field.appendChild(control);
        return field;
    }

    function createQuestionCardEl(q, index1Based) {
        const questionItem = document.createElement('div');
        questionItem.className = 'question-item';
        questionItem.dataset.id = q.id;

        const topRow = document.createElement('div');
        topRow.className = 'question-top-row';

        const leftTop = document.createElement('div');
        leftTop.className = 'question-title-stack';

        const numberLabel = document.createElement('span');
        numberLabel.className = 'question-number';
        numberLabel.textContent = `Question ${index1Based}`;

        const chips = document.createElement('div');
        chips.className = 'question-chips';
        chips.appendChild(createTopicBadgeEl(q.topic || 'Programming'));

        const difficultyChip = document.createElement('span');
        difficultyChip.className = 'mini-chip';
        difficultyChip.textContent = q.difficulty || 'Medium';
        chips.appendChild(difficultyChip);

        const bloomChip = document.createElement('span');
        bloomChip.className = 'mini-chip';
        bloomChip.textContent = q.bloom || 'Apply';
        chips.appendChild(bloomChip);

        leftTop.appendChild(numberLabel);
        leftTop.appendChild(chips);

        const rightTop = document.createElement('div');
        rightTop.className = 'question-controls';

        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'icon-btn';
        duplicateBtn.type = 'button';
        duplicateBtn.title = 'Duplicate question';
        duplicateBtn.setAttribute('aria-label', 'Duplicate question');
        duplicateBtn.innerHTML = '<i class="fas fa-copy"></i>';
        duplicateBtn.addEventListener('click', () => duplicateQuestionById(q.id));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-btn danger';
        removeBtn.type = 'button';
        removeBtn.title = 'Remove question';
        removeBtn.setAttribute('aria-label', 'Remove question');
        removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
        removeBtn.addEventListener('click', () => deleteQuestionById(q.id));

        rightTop.appendChild(duplicateBtn);
        rightTop.appendChild(removeBtn);

        topRow.appendChild(leftTop);
        topRow.appendChild(rightTop);

        const body = document.createElement('div');
        body.className = 'question-body';

        const qInput = document.createElement('textarea');
        qInput.className = 'question-input';
        qInput.placeholder = 'Write the question prompt...';
        qInput.value = q.text || '';
        qInput.rows = 2;
        qInput.required = true;
        qInput.addEventListener('input', () => updateQuestion(q.id, { text: qInput.value }, false));

        const topicSelect = createSelect(TOPIC_OPTIONS.map(t => t.key), q.topic || 'Programming');
        topicSelect.addEventListener('change', () => updateQuestion(q.id, { topic: topicSelect.value }));

        const typeSelect = createSelect(TYPE_OPTIONS, q.type || 'Multiple Choice');
        typeSelect.addEventListener('change', () => {
            const nextType = typeSelect.value;
            updateQuestion(q.id, {
                type: nextType,
                options: nextType === 'Multiple Choice' ? (q.options || ['', '', '', '']) : [],
                answer: nextType === 'Multiple Choice' ? (q.answer || '') : '',
            });
        });

        const difficultySelect = createSelect(DIFFICULTY_OPTIONS, q.difficulty || 'Medium');
        difficultySelect.addEventListener('change', () => updateQuestion(q.id, { difficulty: difficultySelect.value }));

        const bloomSelect = createSelect(BLOOM_OPTIONS, q.bloom || 'Apply');
        bloomSelect.addEventListener('change', () => updateQuestion(q.id, { bloom: bloomSelect.value }));

        const pointsInput = document.createElement('input');
        pointsInput.type = 'number';
        pointsInput.min = '0';
        pointsInput.step = '1';
        pointsInput.className = 'points-input';
        pointsInput.value = String(q.points ?? 0);
        pointsInput.addEventListener('input', () => updateQuestion(q.id, { points: normalizePoints(pointsInput.value) }, false));

        const metaRow = document.createElement('div');
        metaRow.className = 'q-meta-row';
        metaRow.appendChild(createMetaField('Topic', topicSelect));
        metaRow.appendChild(createMetaField('Type', typeSelect));
        metaRow.appendChild(createMetaField('Difficulty', difficultySelect));
        metaRow.appendChild(createMetaField('Bloom Level', bloomSelect));
        metaRow.appendChild(createMetaField('Points', pointsInput));

        const optionsWrap = document.createElement('div');
        optionsWrap.className = 'options-wrap';

        if ((q.type || 'Multiple Choice') === 'Multiple Choice') {
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';
            const opts = Array.isArray(q.options) && q.options.length ? q.options : ['', '', '', ''];

            ['A', 'B', 'C', 'D'].forEach((label, i) => {
                const optionItem = document.createElement('div');
                optionItem.className = 'option-item';

                const optionLabel = document.createElement('span');
                optionLabel.className = 'option-label';
                optionLabel.textContent = `${label}.`;

                const optionInput = document.createElement('input');
                optionInput.type = 'text';
                optionInput.className = 'option-input';
                optionInput.placeholder = `Option ${label}`;
                optionInput.value = opts[i] || '';
                optionInput.addEventListener('input', () => {
                    const next = Array.from(opts);
                    next[i] = optionInput.value;
                    updateQuestion(q.id, { options: next }, false);
                });

                optionItem.appendChild(optionLabel);
                optionItem.appendChild(optionInput);
                optionsContainer.appendChild(optionItem);
            });

            const answerSelect = createSelect(['', 'A', 'B', 'C', 'D'], q.answer || '');
            optionsWrap.appendChild(optionsContainer);
            optionsWrap.appendChild(createMetaField('Correct Answer', answerSelect));
            answerSelect.addEventListener('change', () => updateQuestion(q.id, { answer: answerSelect.value }, false));
        }

        const noteInput = document.createElement('textarea');
        noteInput.className = 'note-input';
        noteInput.placeholder = 'Teacher note or rubric hint...';
        noteInput.value = q.note || '';
        noteInput.rows = 2;
        noteInput.addEventListener('input', () => updateQuestion(q.id, { note: noteInput.value }, false));

        body.appendChild(qInput);
        body.appendChild(metaRow);
        body.appendChild(optionsWrap);
        body.appendChild(createMetaField('Teacher Note', noteInput));

        questionItem.appendChild(topRow);
        questionItem.appendChild(body);
        return questionItem;
    }

    function saveToLocalStorage() {
        const payload = { questions, updatedAt: Date.now() };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('LocalStorage save failed', e);
            return false;
        }
    }

    function loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('quiz_master_exam_v2');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.questions)) return null;
            return parsed.questions;
        } catch (e) {
            console.error('LocalStorage load failed', e);
            return null;
        }
    }

    function triggerAutosave() {
        setSaveState('saving', 'Saving...');
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            const ok = saveToLocalStorage();
            if (ok) setSaveState('saved', 'Saved');
            else setSaveState('', 'Save failed');
        }, 250);
    }

    function computeStats() {
        const totalPoints = questions.reduce((sum, q) => sum + normalizePoints(q.points), 0);
        const topicCount = new Set(questions.map(q => q.topic).filter(Boolean)).size;
        const hasQuestionText = questions.filter(q => (q.text || '').trim()).length;
        const hasPoints = questions.filter(q => normalizePoints(q.points) > 0).length;
        const hasTypeMix = new Set(questions.map(q => q.type).filter(Boolean)).size > 1;
        const hasTopicMix = topicCount > 1;
        const hasAnswers = questions.filter(q => q.type !== 'Multiple Choice' || q.answer).length;

        const checklist = [
            { label: 'At least 5 questions', done: questions.length >= 5 },
            { label: 'All prompts drafted', done: questions.length > 0 && hasQuestionText === questions.length },
            { label: 'Points assigned', done: questions.length > 0 && hasPoints === questions.length },
            { label: 'More than one topic', done: hasTopicMix },
            { label: 'Question type variety', done: hasTypeMix },
            { label: 'MC answers marked', done: questions.length > 0 && hasAnswers === questions.length },
        ];

        const readiness = questions.length ? Math.round((checklist.filter(item => item.done).length / checklist.length) * 100) : 0;
        const duration = questions.reduce((sum, q) => {
            const base = q.type === 'Essay' ? 8 : q.type === 'Problem Set' ? 6 : q.type === 'Multiple Choice' ? 1.5 : 1;
            const difficulty = q.difficulty === 'Hard' ? 1.5 : q.difficulty === 'Easy' ? 0.8 : 1;
            return sum + base * difficulty;
        }, 0);

        return {
            count: questions.length,
            totalPoints,
            topicCount,
            duration: Math.ceil(duration),
            checklist,
            readiness,
        };
    }

    function updateStatsUI() {
        const stats = computeStats();
        if (statQuestionCount) statQuestionCount.textContent = String(stats.count);
        if (statTotalPoints) statTotalPoints.textContent = String(stats.totalPoints);
        if (statDuration) statDuration.textContent = `${stats.duration}m`;
        if (statTopicCount) statTopicCount.textContent = String(stats.topicCount);
        if (readinessScore) readinessScore.textContent = `${stats.readiness}%`;
        if (readinessFill) readinessFill.style.width = `${stats.readiness}%`;
        if (readinessNote) {
            readinessNote.textContent = stats.readiness >= 80
                ? 'Strong exam structure.'
                : stats.readiness >= 45
                    ? 'Good draft. Add variety and answers.'
                    : 'Build the first balanced draft.';
        }
        renderChecklist(stats.checklist);
        renderExportSummary(stats);
    }

    function renderChecklist(items) {
        if (!readinessChecklist) return;
        readinessChecklist.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = `check-item ${item.done ? 'is-done' : ''}`;
            row.innerHTML = `<i class="fas ${item.done ? 'fa-check' : 'fa-circle'}"></i><span>${item.label}</span>`;
            readinessChecklist.appendChild(row);
        });
    }

    function renderExportSummary(stats = computeStats()) {
        if (!exportSummary) return;
        const typeCounts = TYPE_OPTIONS.map(type => ({
            type,
            count: questions.filter(q => q.type === type).length,
        })).filter(item => item.count > 0);

        exportSummary.innerHTML = `
            <div class="export-card"><span>Questions</span><strong>${stats.count}</strong></div>
            <div class="export-card"><span>Total Points</span><strong>${stats.totalPoints}</strong></div>
            <div class="export-card"><span>Estimated Time</span><strong>${stats.duration}m</strong></div>
            <div class="export-card"><span>Readiness</span><strong>${stats.readiness}%</strong></div>
            <div class="export-breakdown">
                <h3>Question Mix</h3>
                ${typeCounts.length ? typeCounts.map(item => `<p>${item.type}: <strong>${item.count}</strong></p>`).join('') : '<p>No questions yet.</p>'}
            </div>
        `;
    }

    function renderPreview() {
        if (!examPreview) return;
        if (!questions.length) {
            examPreview.innerHTML = `
                <div class="preview-empty">
                    <h2>No exam preview yet</h2>
                    <p>Add questions in Build mode to generate a student-facing paper.</p>
                </div>
            `;
            return;
        }

        const grouped = TYPE_OPTIONS.map(type => ({
            type,
            items: questions.filter(q => q.type === type),
        })).filter(group => group.items.length);

        examPreview.innerHTML = `
            <div class="paper-header">
                <div class="paper-school">Polytechnic University of the Philippines</div>
                <div>Institute of Computing Sciences</div>
                <h2>Examination Paper</h2>
                <div class="paper-meta">
                    <span>Name: __________________________</span>
                    <span>Section: _______________________</span>
                    <span>Score: _________________________</span>
                </div>
            </div>
            ${grouped.map((group, groupIndex) => `
                <section class="paper-section">
                    <h3>${romanNumeral(groupIndex + 1)}. ${group.type}</h3>
                    ${group.items.map((q, i) => renderPreviewQuestion(q, i + 1)).join('')}
                </section>
            `).join('')}
        `;
    }

    function renderPreviewQuestion(q, number) {
        const points = normalizePoints(q.points);
        const prompt = escapeHtml(q.text || 'Untitled question');
        const pointLabel = points === 1 ? '1 point' : `${points} points`;

        if (q.type === 'Multiple Choice') {
            const options = (q.options || ['', '', '', '']).map((option, i) => {
                const label = ['A', 'B', 'C', 'D'][i];
                return `<li><span>${label}.</span> ${escapeHtml(option || `Option ${label}`)}</li>`;
            }).join('');
            return `<article class="paper-question"><p><strong>${number}.</strong> ${prompt} <em>(${pointLabel})</em></p><ol class="paper-options">${options}</ol></article>`;
        }

        if (q.type === 'True/False') {
            return `<article class="paper-question"><p><strong>${number}.</strong> ${prompt} <em>(${pointLabel})</em></p><p class="answer-line">True / False</p></article>`;
        }

        return `<article class="paper-question"><p><strong>${number}.</strong> ${prompt} <em>(${pointLabel})</em></p><div class="writing-lines"></div></article>`;
    }

    function romanNumeral(num) {
        return ['I', 'II', 'III', 'IV', 'V', 'VI'][num - 1] || String(num);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function deleteQuestionById(id) {
        questions = questions.filter(q => q.id !== id);
        rerenderAll();
        triggerAutosave();
    }

    function duplicateQuestionById(id) {
        const found = questions.find(q => q.id === id);
        if (!found) return;
        const index = questions.findIndex(q => q.id === id);
        questions.splice(index + 1, 0, { ...found, id: newId(), text: `${found.text || 'Untitled question'} (copy)` });
        rerenderAll();
        triggerAutosave();
    }

    function updateQuestion(id, patch, recreate = true) {
        const idx = questions.findIndex(q => q.id === id);
        if (idx === -1) return;
        questions[idx] = { ...questions[idx], ...patch };
        if (recreate) rerenderAll();
        else {
            updateStatsUI();
            renderPreview();
        }
        triggerAutosave();
    }

    function rerenderAll() {
        if (!questionsContainer) return;
        questionsContainer.innerHTML = '';

        const visible = activeTopic === 'All' ? questions : questions.filter(q => q.topic === activeTopic);
        visible.forEach((q, i) => {
            questionsContainer.appendChild(createQuestionCardEl(q, i + 1));
        });

        if (emptyState) emptyState.classList.toggle('is-hidden', questions.length > 0);
        updateStatsUI();
        renderPreview();
        buildTopicFilter();
    }

    function buildTopicFilter() {
        if (!topicFilterContainer) return;
        topicFilterContainer.innerHTML = '';

        const topics = [{ key: 'All', dotVar: '--topic-default', label: 'All Topics' }, ...TOPIC_OPTIONS.map(t => ({ ...t, label: t.key }))];

        topics.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'topic-btn';
            btn.type = 'button';
            btn.dataset.topic = t.key;
            if (activeTopic === t.key) btn.classList.add('is-active');

            const dot = document.createElement('span');
            dot.className = 'topic-dot';
            dot.style.background = `var(${t.dotVar})`;

            const label = document.createElement('span');
            label.textContent = t.label;

            const count = document.createElement('strong');
            count.textContent = t.key === 'All'
                ? String(questions.length)
                : String(questions.filter(q => q.topic === t.key).length);

            btn.appendChild(dot);
            btn.appendChild(label);
            btn.appendChild(count);
            btn.addEventListener('click', () => {
                activeTopic = t.key;
                rerenderAll();
            });

            topicFilterContainer.appendChild(btn);
        });
    }

    function createDefaultQuestion(seed = {}) {
        return {
            id: newId(),
            text: seed.text || '',
            topic: seed.topic || 'Programming',
            type: seed.type || 'Multiple Choice',
            points: normalizePoints(seed.points ?? 1),
            difficulty: seed.difficulty || 'Medium',
            bloom: seed.bloom || 'Apply',
            options: Array.isArray(seed.options) ? seed.options : ['', '', '', ''],
            answer: seed.answer || '',
            note: seed.note || '',
        };
    }

    function addQuestion(seed) {
        questions.push(createDefaultQuestion(seed));
        activeView = 'build';
        switchView('build');
        rerenderAll();
        triggerAutosave();
    }

    function applyTemplate(templateKey) {
        const seeds = TEMPLATE_SETS[templateKey] || [];
        seeds.forEach(seed => questions.push(createDefaultQuestion(seed)));
        activeTopic = 'All';
        activeView = 'build';
        switchView('build');
        rerenderAll();
        triggerAutosave();
    }

    function switchView(view) {
        activeView = view;
        document.querySelectorAll('.studio-tab').forEach(tab => {
            tab.classList.toggle('is-active', tab.dataset.view === view);
        });
        document.querySelectorAll('.studio-view').forEach(panel => {
            panel.classList.toggle('is-active', panel.id === `${view}-view`);
        });
        renderPreview();
        renderExportSummary();
    }

    function openModal() {
        if (!saveModal) return;
        fillSaveModal();
        saveModal.classList.add('is-open');
        saveModal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
        if (!saveModal) return;
        saveModal.classList.remove('is-open');
        saveModal.setAttribute('aria-hidden', 'true');
    }

    function fillSaveModal() {
        if (!modalRowsEl) return;
        const totalPoints = questions.reduce((sum, q) => sum + normalizePoints(q.points), 0);

        modalQuestionCountEl.textContent = String(questions.length);
        modalTotalPointsEl.textContent = String(totalPoints);
        modalRowsEl.innerHTML = '';

        questions.forEach((q, i) => {
            const tr = document.createElement('tr');
            [String(i + 1), q.topic || 'Programming', q.type || 'Multiple Choice', String(normalizePoints(q.points))].forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });
            modalRowsEl.appendChild(tr);
        });
    }

    async function copyExamJsonToClipboard() {
        const payload = {
            app: 'QuizCraft Studio',
            institution: 'Polytechnic University of the Philippines',
            questions,
            stats: computeStats(),
            exportedAt: new Date().toISOString(),
        };

        const json = JSON.stringify(payload, null, 2);
        try {
            await navigator.clipboard.writeText(json);
            setSaveState('saved', 'Exported');
        } catch (e) {
            console.error('Clipboard write failed', e);
            setSaveState('saved', 'Saved');
        }
    }

    function onExportExam() {
        if (questions.length === 0) {
            setSaveState('', 'Add at least 1 question');
            alert('Please add at least one question before exporting.');
            return;
        }
        switchView('export');
        openModal();
        triggerAutosave();
    }

    function normalizeLoadedQuestion(q) {
        return createDefaultQuestion({
            ...q,
            difficulty: q.difficulty || 'Medium',
            bloom: q.bloom || 'Apply',
            answer: q.answer || '',
            note: q.note || '',
        });
    }

    modalCloseEls.forEach(el => el.addEventListener('click', closeModal));
    if (modalCopyJsonBtn) modalCopyJsonBtn.addEventListener('click', copyExamJsonToClipboard);
    if (exportCopyJsonBtn) exportCopyJsonBtn.addEventListener('click', copyExamJsonToClipboard);
    if (exportOpenModalBtn) exportOpenModalBtn.addEventListener('click', openModal);

    document.querySelectorAll('.studio-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
    });

    addQuestionBtn.addEventListener('click', () => addQuestion());
    if (emptyAddQuestionBtn) emptyAddQuestionBtn.addEventListener('click', () => addQuestion());
    saveExamBtn.addEventListener('click', onExportExam);

    const loaded = loadFromLocalStorage();
    if (loaded && loaded.length) {
        questions = loaded.map(normalizeLoadedQuestion);
        setSaveState('saved', 'Loaded');
    } else {
        questions = [
            createDefaultQuestion(createQuestionSeed("Which CSS unit is relative to a font's x-height?", 'Programming', 'Multiple Choice', 1, 'Easy', 'Remember', ['%', 'cm', 'ex', 'pt'], 'C')),
            createDefaultQuestion(createQuestionSeed('Which device forwards packets between different networks?', 'Networking', 'Multiple Choice', 1, 'Easy', 'Remember', ['Switch', 'Router', 'Hub', 'Repeater'], 'B')),
        ];
        triggerAutosave();
    }

    rerenderAll();
});
