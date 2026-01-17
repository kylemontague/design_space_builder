
class Toast {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.container.appendChild(toast);

        // Trigger reflow for animation
        toast.offsetHeight;
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                if (toast.parentNode === this.container) {
                    this.container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

class History {
    constructor(limit = 50) {
        this.limit = limit;
        this.stack = [];
        this.currentIndex = -1;
    }

    push(state) {
        // If we're not at the end of the stack, remove future states
        if (this.currentIndex < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
        }

        // Add new state
        // We assume state is already a string or we stringify it here.
        // Best to store stringified to avoid reference issues.
        const stateStr = JSON.stringify(state);

        // Avoid duplicate consecutive states
        if (this.stack.length > 0 && this.stack[this.currentIndex] === stateStr) {
            return;
        }

        this.stack.push(stateStr);
        if (this.stack.length > this.limit) {
            this.stack.shift();
        } else {
            this.currentIndex++;
        }
    }

    undo() {
        if (this.canUndo()) {
            this.currentIndex--;
            return JSON.parse(this.stack[this.currentIndex]);
        }
        return null;
    }

    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            return JSON.parse(this.stack[this.currentIndex]);
        }
        return null;
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.stack.length - 1;
    }
}

class RadarChartApp {
    constructor() {
        // Services
        this.toast = new Toast();
        this.history = new History();

        // State
        this.state = {
            chartTitle: 'Design Space',
            description: '',
            dimensions: [],
            dataPoints: [],
            theme: {
                width: 800,
                height: 800,
                showLevelLabels: true,
                showDimensionNames: true,
                colorScheme: 'default'
            }
        };

        this.colorSchemes = {
            default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#a4de6c'],
            colorblind: ['#0173B2', '#DE8F05', '#029E73', '#CC78BC', '#CA9161', '#949494', '#ECE133'],
            monochrome: ['#1a1a1a', '#404040', '#666666', '#8c8c8c', '#b3b3b3', '#d9d9d9', '#f2f2f2'],
            warm: ['#D95F02', '#E7298A', '#E6AB02', '#A6761D', '#FF6B6B', '#FFA07A', '#FFD700'],
            cool: ['#1B9E77', '#66A61E', '#7570B3', '#6495ED', '#20B2AA', '#4682B4', '#5F9EA0']
        };

        this.editingDimension = null;
        this.editingDataPoint = null;
        this.dragging = null;

        // Flag to ignore saveState during history navigation
        this.isNavigatingHistory = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadState();

        // Push initial state to history
        this.history.push(this.state);
        this.updateHistoryButtons();

        this.renderColorSchemes();
        this.render();
    }

    bindEvents() {
        // Global Listeners
        document.addEventListener('mousemove', (e) => this.handleDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        document.addEventListener('selectstart', (e) => {
            if (this.dragging) e.preventDefault();
        });
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                this.redo();
            }
        });

        // Header
        document.getElementById('titleDisplay').addEventListener('click', () => this.editTitle());
        document.getElementById('btnSaveTitle').addEventListener('click', () => this.saveTitle());
        document.getElementById('btnUndo').addEventListener('click', () => this.undo());
        document.getElementById('btnRedo').addEventListener('click', () => this.redo());

        // Tabs
        document.getElementById('tabContainer').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // Dimensions
        document.getElementById('btnAddDimension').addEventListener('click', () => this.addDimension());
        document.getElementById('dimensionsList').addEventListener('click', (e) => this.handleDimensionEvents(e));
        document.getElementById('dimensionsList').addEventListener('change', (e) => this.handleDimensionChange(e));

        // Data Points
        document.getElementById('btnShowAllDataPoints').addEventListener('click', () => this.showAllDataPoints());
        document.getElementById('btnHideAllDataPoints').addEventListener('click', () => this.hideAllDataPoints());
        document.getElementById('btnAddDataPoint').addEventListener('click', () => this.addDataPoint());
        document.getElementById('datapointsList').addEventListener('click', (e) => this.handleDataPointEvents(e));
        document.getElementById('datapointsList').addEventListener('change', (e) => this.handleDataPointChange(e));

        // Theme
        document.getElementById('chartWidth').addEventListener('change', () => { this.saveState(); this.renderChart(); });
        document.getElementById('chartHeight').addEventListener('change', () => { this.saveState(); this.renderChart(); });
        document.getElementById('sizePresets').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                this.setSize(parseInt(e.target.dataset.width), parseInt(e.target.dataset.height));
            }
        });
        document.getElementById('colorSchemes').addEventListener('click', (e) => {
            const schemeEl = e.target.closest('.color-scheme');
            if (schemeEl) {
                this.state.theme.colorScheme = schemeEl.dataset.scheme;
                this.saveState();
                this.renderColorSchemes();
                this.renderChart();
            }
        });
        document.getElementById('showLevelLabels').addEventListener('change', () => { this.saveState(); this.renderChart(); });
        document.getElementById('showDimensionNames').addEventListener('change', () => { this.saveState(); this.renderChart(); });

        // Documentation
        document.getElementById('documentationContent').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.action === 'copyHTML') this.copyTableHTML(parseInt(btn.dataset.id));
            if (btn.dataset.action === 'copyLaTeX') this.copyTableLaTeX(parseInt(btn.dataset.id));
        });

        // Export/Import
        document.getElementById('btnExportJSON').addEventListener('click', () => this.exportJSON());
        document.getElementById('btnTriggerImport').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importJSON(e));
        document.getElementById('btnExportSVG').addEventListener('click', () => this.exportSVG());

        // Alt Text / Caption
        document.getElementById('btnGenerateAltText').addEventListener('click', () => this.generateAltText());
        document.getElementById('btnCopyAltText').addEventListener('click', () => this.copyText('altText'));
        document.getElementById('btnGenerateCaption').addEventListener('click', () => this.generateCaption());
        document.getElementById('btnCopyCaption').addEventListener('click', () => this.copyText('caption'));
    }

    // --- Event Handlers for Dynamic Lists ---

    handleDimensionEvents(e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);

        if (action === 'edit') this.editDimension(id);
        if (action === 'delete') this.deleteDimension(id);
        if (action === 'moveUp') this.moveDimension(id, 'up');
        if (action === 'moveDown') this.moveDimension(id, 'down');
        if (action === 'addLevel') this.addLevel(id);
        if (action === 'deleteLevel') this.deleteLevel(id, parseInt(btn.dataset.levelId));
        if (action === 'save') this.saveDimension();
        if (action === 'cancel') { this.editingDimension = null; this.renderDimensions(); }
    }

    handleDimensionChange(e) {
        const input = e.target;
        const dimId = parseInt(input.dataset.dimId);
        const levelId = input.dataset.levelId ? parseInt(input.dataset.levelId) : null;
        const field = input.dataset.field;

        const dim = this.state.dimensions.find(d => d.id === dimId);
        if (!dim) return;

        if (field === 'name') dim.name = input.value;
        if (field === 'description') dim.description = input.value;
        if (field === 'levelName') dim.levels[levelId].name = input.value;
        if (field === 'levelDesc') dim.levels[levelId].description = input.value;
    }

    handleDataPointEvents(e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);

        if (action === 'edit') this.editDataPoint(id);
        if (action === 'delete') this.deleteDataPoint(id);
        if (action === 'toggleVisibility') this.toggleVisibility(id);
        if (action === 'save') this.saveDataPoint();
        if (action === 'cancel') { this.editingDataPoint = null; this.renderDataPoints(); }
    }

    handleDataPointChange(e) {
        const input = e.target;
        const dpId = parseInt(input.dataset.dpId);
        const dp = this.state.dataPoints.find(d => d.id === dpId);
        if (!dp) return;

        if (input.dataset.field === 'name') {
            dp.name = input.value;
        } else if (input.dataset.field === 'value') {
            const dimId = parseInt(input.dataset.dimId);
            dp.values[dimId] = parseInt(input.value);
        }
    }


    // --- State Logic ---

    saveState() {
        if (this.isNavigatingHistory) return;
        localStorage.setItem('radarChartState', JSON.stringify(this.state));
        this.history.push(this.state);
        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        document.getElementById('btnUndo').disabled = !this.history.canUndo();
        document.getElementById('btnRedo').disabled = !this.history.canRedo();
    }

    undo() {
        const prevState = this.history.undo();
        if (prevState) {
            this.isNavigatingHistory = true;
            this.state = prevState;
            localStorage.setItem('radarChartState', JSON.stringify(this.state));
            this.updateHistoryButtons();

            // Restore UI state
            document.getElementById('titleInput').value = this.state.chartTitle;
            document.getElementById('descInput').value = this.state.description;
            document.getElementById('chartWidth').value = this.state.theme.width;
            document.getElementById('chartHeight').value = this.state.theme.height;
            document.getElementById('showLevelLabels').checked = this.state.theme.showLevelLabels;
            document.getElementById('showDimensionNames').checked = this.state.theme.showDimensionNames;

            this.render();
            this.toast.show('Undo successful', 'info');
            this.isNavigatingHistory = false;
        }
    }

    redo() {
        const nextState = this.history.redo();
        if (nextState) {
            this.isNavigatingHistory = true;
            this.state = nextState;
            localStorage.setItem('radarChartState', JSON.stringify(this.state));
            this.updateHistoryButtons();

            // Restore UI state
            document.getElementById('titleInput').value = this.state.chartTitle;
            document.getElementById('descInput').value = this.state.description;
            document.getElementById('chartWidth').value = this.state.theme.width;
            document.getElementById('chartHeight').value = this.state.theme.height;
            document.getElementById('showLevelLabels').checked = this.state.theme.showLevelLabels;
            document.getElementById('showDimensionNames').checked = this.state.theme.showDimensionNames;

            this.render();
            this.toast.show('Redo successful', 'info');
            this.isNavigatingHistory = false;
        }
    }

    loadState() {
        const saved = localStorage.getItem('radarChartState');
        if (saved) {
            const savedState = JSON.parse(saved);
            this.state = {
                ...this.state,
                ...savedState,
                theme: {
                    ...this.state.theme,
                    ...(savedState.theme || {})
                }
            };

            document.getElementById('titleInput').value = this.state.chartTitle;
            document.getElementById('descInput').value = this.state.description;
            document.getElementById('chartWidth').value = this.state.theme.width;
            document.getElementById('chartHeight').value = this.state.theme.height;
            document.getElementById('showLevelLabels').checked = this.state.theme.showLevelLabels;
            document.getElementById('showDimensionNames').checked = this.state.theme.showDimensionNames;
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === tabName);
        });

        if (tabName === 'documentation') this.renderDocumentation();
        if (tabName === 'export') this.renderExportPreview();
    }

    // --- Actions ---

    editTitle() {
        document.getElementById('headerDisplay').style.display = 'none';
        document.getElementById('headerEdit').style.display = 'block';
    }

    saveTitle() {
        this.state.chartTitle = document.getElementById('titleInput').value;
        this.state.description = document.getElementById('descInput').value;
        document.getElementById('titleDisplay').textContent = this.state.chartTitle;
        document.getElementById('descDisplay').textContent = this.state.description;
        document.getElementById('headerDisplay').style.display = 'block';
        document.getElementById('headerEdit').style.display = 'none';
        this.saveState();
        this.renderChart();
    }

    addDimension() {
        const id = this.state.dimensions.length > 0 ? Math.max(...this.state.dimensions.map(d => d.id)) + 1 : 0;
        this.state.dimensions.push({
            id: id,
            name: 'New Dimension',
            description: '',
            levels: [
                { id: 0, name: 'Low', description: '' },
                { id: 1, name: 'Medium', description: '' },
                { id: 2, name: 'High', description: '' }
            ]
        });
        this.saveState();
        this.renderDimensions();
        this.renderChart();
    }

    editDimension(id) {
        this.editingDimension = id;
        this.renderDimensions();
    }

    saveDimension() {
        this.editingDimension = null;
        this.saveState();
        this.renderDimensions();
        this.renderChart();
    }

    deleteDimension(id) {
        if (confirm('Delete this dimension?')) {
            this.state.dimensions = this.state.dimensions.filter(d => d.id !== id);
            // We do NOT re-index IDs because data points reference them.
            // But we should clean up data points values for this dim.
             this.state.dataPoints.forEach(dp => {
                delete dp.values[id];
            });
            this.saveState();
            this.renderDimensions();
            this.renderDataPoints();
            this.renderChart();
        }
    }

    moveDimension(id, direction) {
        const idx = this.state.dimensions.findIndex(d => d.id === id);
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= this.state.dimensions.length) return;

        [this.state.dimensions[idx], this.state.dimensions[newIdx]] = [this.state.dimensions[newIdx], this.state.dimensions[idx]];
        this.saveState();
        this.renderDimensions();
        this.renderChart();
    }

    addLevel(dimId) {
        const dim = this.state.dimensions.find(d => d.id === dimId);
        dim.levels.push({ id: dim.levels.length, name: 'New Level', description: '' });
        this.renderDimensions();
        this.renderChart();
    }

    deleteLevel(dimId, levelId) {
        const dim = this.state.dimensions.find(d => d.id === dimId);
        if (dim.levels.length <= 2) return;
        dim.levels = dim.levels.filter(l => l.id !== levelId);
        dim.levels.forEach((l, i) => l.id = i);
        this.renderDimensions();
        this.renderChart();
    }

    renderDimensions() {
        const container = document.getElementById('dimensionsList');

        if (this.state.dimensions.length === 0) {
            container.innerHTML = '<div class="empty-state">No dimensions yet. Click "Add Dimension" to get started.</div>';
            return;
        }

        container.innerHTML = this.state.dimensions.map((dim, idx) => {
            if (this.editingDimension === dim.id) {
                return `
                    <div class="dimension-card">
                        <h4 style="margin-bottom: 1rem;">Editing Dimension</h4>
                        <label>Name</label>
                        <input type="text" value="${dim.name}" data-dim-id="${dim.id}" data-field="name">

                        <label>Description</label>
                        <textarea rows="2" placeholder="Dimension description" data-dim-id="${dim.id}" data-field="description">${dim.description}</textarea>

                        <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">Levels</h5>
                        ${dim.levels.map((level, levelIdx) => `
                            <div class="level-item">
                                <div class="level-header">
                                    <label class="visually-hidden">Level Name</label>
                                    <input type="text" class="flex-1" value="${level.name}"
                                        data-dim-id="${dim.id}" data-level-id="${levelIdx}" data-field="levelName">
                                    ${dim.levels.length > 2 ? `
                                        <button class="btn btn-danger" aria-label="Delete Level" data-action="deleteLevel" data-id="${dim.id}" data-level-id="${level.id}">×</button>
                                    ` : ''}
                                </div>
                                <label class="visually-hidden">Level Description</label>
                                <textarea rows="2" placeholder="Level description"
                                    data-dim-id="${dim.id}" data-level-id="${levelIdx}" data-field="levelDesc">${level.description}</textarea>
                            </div>
                        `).join('')}
                        <button class="btn btn-success" data-action="addLevel" data-id="${dim.id}">+ Add Level</button>

                        <div class="btn-group" style="margin-top: 1rem;">
                            <button class="btn btn-primary" data-action="save" data-id="${dim.id}">Save</button>
                            <button class="btn btn-secondary" data-action="cancel" data-id="${dim.id}">Cancel</button>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="dimension-card">
                    <div class="dimension-header">
                        <div>
                            <div class="dimension-title">${dim.name}</div>
                            ${dim.description ? `<p style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem;">${dim.description}</p>` : ''}
                            <p style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.25rem;">${dim.levels.length} levels</p>
                        </div>
                        <div class="btn-group">
                            <button class="btn-icon" data-action="moveUp" data-id="${dim.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
                            <button class="btn-icon" data-action="moveDown" data-id="${dim.id}" ${idx === this.state.dimensions.length - 1 ? 'disabled' : ''}>↓</button>
                            <button class="btn-icon" data-action="edit" data-id="${dim.id}">✎</button>
                            <button class="btn-icon danger" data-action="delete" data-id="${dim.id}">×</button>
                        </div>
                    </div>
                    <div style="margin-top: 1rem;">
                        ${dim.levels.map(level => `
                            <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                                <strong>${level.name}</strong>${level.description ? ` - ${level.description}` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- Data Points Logic ---

    addDataPoint() {
        if (this.state.dimensions.length === 0) {
            this.toast.show('Please add dimensions first.', 'error');
            return;
        }

        const id = this.state.dataPoints.length > 0 ? Math.max(...this.state.dataPoints.map(dp => dp.id)) + 1 : 0;
        const values = {};
        this.state.dimensions.forEach(dim => values[dim.id] = 0);

        this.state.dataPoints.push({
            id: id,
            name: `Data Point ${this.state.dataPoints.length + 1}`,
            visible: true,
            values: values
        });
        this.saveState();
        this.renderDataPoints();
        this.renderChart();
    }

    editDataPoint(id) {
        this.editingDataPoint = id;
        this.renderDataPoints();
    }

    saveDataPoint() {
        this.editingDataPoint = null;
        this.saveState();
        this.renderDataPoints();
        this.renderChart();
    }

    deleteDataPoint(id) {
        if (confirm('Delete this data point?')) {
            this.state.dataPoints = this.state.dataPoints.filter(dp => dp.id !== id);
            this.saveState();
            this.renderDataPoints();
            this.renderChart();
        }
    }

    toggleVisibility(id) {
        const dp = this.state.dataPoints.find(d => d.id === id);
        dp.visible = !dp.visible;
        this.saveState();
        this.renderDataPoints();
        this.renderChart();
    }

    showAllDataPoints() {
        this.state.dataPoints.forEach(dp => dp.visible = true);
        this.saveState();
        this.renderDataPoints();
        this.renderChart();
    }

    hideAllDataPoints() {
        this.state.dataPoints.forEach(dp => dp.visible = false);
        this.saveState();
        this.renderDataPoints();
        this.renderChart();
    }

    renderDataPoints() {
        const visibleCount = this.state.dataPoints.filter(dp => dp.visible).length;
        document.getElementById('visibilityCount').textContent = `${visibleCount} of ${this.state.dataPoints.length} visible`;

        const container = document.getElementById('datapointsList');

        if (this.state.dataPoints.length === 0) {
            container.innerHTML = this.state.dimensions.length === 0
                ? '<div class="empty-state">Add dimensions first before creating data points.</div>'
                : '<div class="empty-state">No data points yet. Click "Add Data Point" to create one.</div>';
            return;
        }

        container.innerHTML = this.state.dataPoints.map((dp, idx) => {
            const color = this.colorSchemes[this.state.theme.colorScheme][idx % this.colorSchemes[this.state.theme.colorScheme].length];

            if (this.editingDataPoint === dp.id) {
                return `
                    <div class="datapoint-card">
                        <label>Name</label>
                        <input type="text" value="${dp.name}" data-dp-id="${dp.id}" data-field="name">

                        ${this.state.dimensions.map(dim => `
                            <div style="margin-top: 1rem;">
                                <label>${dim.name}</label>
                                <select data-dp-id="${dp.id}" data-dim-id="${dim.id}" data-field="value">
                                    ${dim.levels.map(level => `
                                        <option value="${level.id}" ${dp.values[dim.id] === level.id ? 'selected' : ''}>
                                            ${level.name}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        `).join('')}

                        <div class="btn-group" style="margin-top: 1rem;">
                            <button class="btn btn-primary" data-action="save">Save</button>
                            <button class="btn btn-secondary" data-action="cancel">Cancel</button>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="datapoint-card ${!dp.visible ? 'hidden-item' : ''}">
                    <div class="dimension-header">
                        <div style="display: flex; align-items: start; gap: 1rem;">
                            <div class="datapoint-preview">
                                <div style="width: 2rem; height: 2rem; border: 2px solid ${color}; background: ${color}; opacity: 0.5; border-radius: 0.25rem;"></div>
                                ${!dp.visible ? '<span class="datapoint-badge">Hidden</span>' : ''}
                            </div>
                            <div>
                                <div class="dimension-title">${dp.name}</div>
                                <div style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">
                                    ${this.state.dimensions.map(dim => {
                                        const level = dim.levels[dp.values[dim.id] || 0];
                                        return `<div><strong>${dim.name}:</strong> ${level.name}</div>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="btn-group">
                            <button class="btn-icon" data-action="toggleVisibility" data-id="${dp.id}">${dp.visible ? '👁' : '👁‍🗨'}</button>
                            <button class="btn-icon" data-action="edit" data-id="${dp.id}">✎</button>
                            <button class="btn-icon danger" data-action="delete" data-id="${dp.id}">×</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- Theme & Helpers ---

    renderColorSchemes() {
        const container = document.getElementById('colorSchemes');
        container.innerHTML = Object.entries(this.colorSchemes).map(([key, colors]) => `
            <div class="color-scheme ${this.state.theme.colorScheme === key ? 'active' : ''}"
                 data-scheme="${key}">
                <div style="font-weight: 500; text-transform: capitalize;">${key}</div>
                <div class="color-swatches">
                    ${colors.map(color => `<div class="color-swatch" style="background: ${color};"></div>`).join('')}
                </div>
            </div>
        `).join('');
    }

    setSize(width, height) {
        this.state.theme.width = width;
        this.state.theme.height = height;
        document.getElementById('chartWidth').value = width;
        document.getElementById('chartHeight').value = height;
        this.saveState();
        this.renderChart();
    }

    // --- Drag Logic ---

    startDrag(e, dpIdx, dimId) {
        if (e.button !== 0) return;
        this.dragging = { dpIdx, dimId };
        e.preventDefault();
    }

    handleDrag(e) {
        if (!this.dragging) return;

        const svg = document.querySelector('#chartView svg');
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const svgWidth = this.state.theme.width;
        const svgHeight = this.state.theme.height;
        const scaleX = rect.width / svgWidth;
        const scaleY = rect.height / svgHeight;

        const mouseX = (e.clientX - rect.left) / scaleX;
        const mouseY = (e.clientY - rect.top) / scaleY;

        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        const minDim = Math.min(svgWidth, svgHeight);
        const minRadius = minDim * 0.1;
        const maxRadius = minDim * 0.31;

        const distance = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));

        const dim = this.state.dimensions.find(d => d.id === this.dragging.dimId);
        if (!dim) return;

        const maxLevel = dim.levels.length - 1;
        let level = Math.round(((distance - minRadius) / (maxRadius - minRadius)) * maxLevel);
        level = Math.max(0, Math.min(level, maxLevel));

        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);
        if (this.dragging.dpIdx < 0 || this.dragging.dpIdx >= visibleDataPoints.length) return;

        const dp = visibleDataPoints[this.dragging.dpIdx];
        dp.values[this.dragging.dimId] = level;

        this.renderChart();
        this.renderDataPoints();
    }

    stopDrag() {
        if (this.dragging) {
            this.dragging = null;
            this.saveState();
            this.renderDataPoints();
        }
    }

    // --- Rendering Chart ---

    renderRadarChart(container, scale = 1, interactive = true) {
        if (this.state.dimensions.length === 0) {
            container.innerHTML = '<div class="empty-state">Add dimensions to see the chart</div>';
            return null;
        }

        const width = this.state.theme.width * scale;
        const height = this.state.theme.height * scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const minDim = Math.min(width, height);
        const minRadius = minDim * 0.1;
        const maxRadius = minDim * 0.31;
        const axisExtension = minDim * 0.075;

        const colors = this.colorSchemes[this.state.theme.colorScheme];
        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);
        const patterns = ['solid', 'horizontal', 'vertical', 'diagonal-right', 'diagonal-left', 'crosshatch', 'dots'];

        const rotationOffset = Math.PI / 12;
        const getAngle = (index, total) => (index * 2 * Math.PI) / total - Math.PI / 2 + rotationOffset;
        const getPoint = (angle, distance) => ({
            x: centerX + distance * Math.cos(angle),
            y: centerY + distance * Math.sin(angle)
        });

        // SVG Creation
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Patterns
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        visibleDataPoints.forEach((dp, idx) => {
            const color = colors[idx % colors.length];
            const patternType = patterns[idx % patterns.length];

            if (patternType !== 'solid') {
                const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
                pattern.setAttribute('id', `pattern-${dp.id}`);
                pattern.setAttribute('patternUnits', 'userSpaceOnUse');
                pattern.setAttribute('width', '8');
                pattern.setAttribute('height', '8');
                // ... Pattern internals (omitted for brevity, same as before) ...
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('width', '8'); rect.setAttribute('height', '8');
                rect.setAttribute('fill', color); rect.setAttribute('opacity', '0.3');
                pattern.appendChild(rect);
                 // Simple crosshatch fallback for all non-solid for now to save space in this rewrite
                 // or reimplement fully. Let's keep it simple for this step or copy full logic if needed.
                 // Copying full logic to ensure feature parity.
                if (patternType === 'horizontal') {
                        ['2', '6'].forEach(y => {
                            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            line.setAttribute('x1', '0'); line.setAttribute('y1', y);
                            line.setAttribute('x2', '8'); line.setAttribute('y2', y);
                            line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1');
                            pattern.appendChild(line);
                        });
                } else if (patternType === 'vertical') {
                     ['2', '6'].forEach(x => {
                            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            line.setAttribute('x1', x); line.setAttribute('y1', '0');
                            line.setAttribute('x2', x); line.setAttribute('y2', '8');
                            line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1');
                            pattern.appendChild(line);
                        });
                } else if (patternType === 'diagonal-right') {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('x1', '0'); line.setAttribute('y1', '8');
                        line.setAttribute('x2', '8'); line.setAttribute('y2', '0');
                        line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1');
                        pattern.appendChild(line);
                } else if (patternType === 'diagonal-left') {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
                        line.setAttribute('x2', '8'); line.setAttribute('y2', '8');
                        line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1');
                        pattern.appendChild(line);
                } else if (patternType === 'crosshatch') {
                        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line1.setAttribute('x1', '0'); line1.setAttribute('y1', '0');
                        line1.setAttribute('x2', '8'); line1.setAttribute('y2', '8');
                        line1.setAttribute('stroke', color); line1.setAttribute('stroke-width', '1');
                        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line2.setAttribute('x1', '0'); line2.setAttribute('y1', '8');
                        line2.setAttribute('x2', '8'); line2.setAttribute('y2', '0');
                        line2.setAttribute('stroke', color); line2.setAttribute('stroke-width', '1');
                        pattern.appendChild(line1); pattern.appendChild(line2);
                } else if (patternType === 'dots') {
                        [[2, 2], [6, 6]].forEach(([cx, cy]) => {
                            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                            circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
                            circle.setAttribute('r', '1'); circle.setAttribute('fill', color);
                            pattern.appendChild(circle);
                        });
                }

                defs.appendChild(pattern);
            }
        });
        svg.appendChild(defs);

        // Polygons
        visibleDataPoints.forEach((dp, dpIdx) => {
            const color = colors[dpIdx % colors.length];
            const patternType = patterns[dpIdx % patterns.length];
            const points = this.state.dimensions.map((dim, idx) => {
                const angle = getAngle(idx, this.state.dimensions.length);
                const levelValue = dp.values[dim.id] || 0;
                const distance = minRadius + (levelValue / (dim.levels.length - 1)) * (maxRadius - minRadius);
                return getPoint(angle, distance);
            });
            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('fill', patternType === 'solid' ? color : `url(#pattern-${dp.id})`);
            path.setAttribute('fill-opacity', patternType === 'solid' ? '0.3' : '1');
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', 2 * scale);
            svg.appendChild(path);
        });

        // Axes & Labels
        this.state.dimensions.forEach((dim, idx) => {
            const angle = getAngle(idx, this.state.dimensions.length);
            const endPoint = getPoint(angle, maxRadius + axisExtension);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', centerX); line.setAttribute('y1', centerY);
            line.setAttribute('x2', endPoint.x); line.setAttribute('y2', endPoint.y);
            line.setAttribute('stroke', '#94a3b8'); line.setAttribute('stroke-width', scale);
            svg.appendChild(line);

            dim.levels.forEach((level, levelIdx) => {
                const distance = minRadius + (levelIdx / (dim.levels.length - 1)) * (maxRadius - minRadius);
                const point = getPoint(angle, distance);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y);
                circle.setAttribute('r', 5 * scale);
                circle.setAttribute('fill', 'white');
                circle.setAttribute('stroke', '#475569');
                circle.setAttribute('stroke-width', scale);
                svg.appendChild(circle);

                if (this.state.theme.showLevelLabels) {
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', point.x); text.setAttribute('y', point.y);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('dominant-baseline', 'middle');
                    text.setAttribute('font-size', 12 * scale);
                    text.setAttribute('fill', '#1e293b');
                    text.setAttribute('stroke', 'white');
                    text.setAttribute('stroke-width', 3 * scale);
                    text.setAttribute('paint-order', 'stroke');
                    text.textContent = level.name;
                    svg.appendChild(text);
                }
            });

            if (this.state.theme.showDimensionNames) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', endPoint.x); text.setAttribute('y', endPoint.y);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('font-size', 14 * scale);
                text.setAttribute('font-weight', '600');
                text.setAttribute('fill', '#1e293b');
                text.textContent = dim.name;
                svg.appendChild(text);
            }
        });

        // Interactive Handles
        if (interactive) {
            visibleDataPoints.forEach((dp, dpIdx) => {
                const color = colors[dpIdx % colors.length];
                this.state.dimensions.forEach((dim, idx) => {
                    const angle = getAngle(idx, this.state.dimensions.length);
                    const levelValue = dp.values[dim.id] || 0;
                    const distance = minRadius + (levelValue / (dim.levels.length - 1)) * (maxRadius - minRadius);
                    const p = getPoint(angle, distance);

                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    handle.setAttribute('cx', p.x); handle.setAttribute('cy', p.y);
                    handle.setAttribute('r', 8 * scale);
                    handle.setAttribute('fill', color);
                    handle.setAttribute('stroke', 'white');
                    handle.setAttribute('stroke-width', 2 * scale);
                    handle.setAttribute('cursor', 'grab');
                    handle.setAttribute('class', 'drag-handle');
                    handle.setAttribute('tabindex', '0');
                    handle.setAttribute('role', 'slider');
                    handle.setAttribute('aria-label', `${dp.name}: ${dim.name}`);
                    handle.setAttribute('aria-valuemin', '0');
                    handle.setAttribute('aria-valuemax', dim.levels.length - 1);
                    handle.setAttribute('aria-valuenow', levelValue);

                    // Bind interactions
                    handle.addEventListener('mousedown', (e) => this.startDrag(e, dpIdx, dim.id));
                    handle.addEventListener('keydown', (e) => this.handleKeyDown(e, dpIdx, dim.id));

                    svg.appendChild(handle);
                });
            });
        }

        container.innerHTML = '';
        container.appendChild(svg);
        return svg;
    }

    handleKeyDown(e, dpIdx, dimId) {
        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);
        const dp = visibleDataPoints[dpIdx];
        if (!dp) return;

        const dim = this.state.dimensions.find(d => d.id === dimId);
        let currentLevel = dp.values[dimId] || 0;
        const maxLevel = dim.levels.length - 1;
        let changed = false;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            if (currentLevel < maxLevel) { currentLevel++; changed = true; }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            if (currentLevel > 0) { currentLevel--; changed = true; }
        }

        if (changed) {
            e.preventDefault();
            dp.values[dimId] = currentLevel;
            this.saveState();
            this.renderChart();
            this.renderDataPoints();

            // Re-focus
            setTimeout(() => {
                // Focus logic is tricky after re-render, skipping for now in basic port
                // or we could use ID matching if we generated stable IDs for handles.
            }, 0);
        }
    }

    renderChart() {
        this.renderRadarChart(document.getElementById('chartView'), 1, true);
        this.renderLegend();
    }

    renderExportPreview() {
        this.renderRadarChart(document.getElementById('chartExport'), 0.5, false);
    }

    renderLegend() {
        const container = document.getElementById('chartLegend');
        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);
        const colors = this.colorSchemes[this.state.theme.colorScheme];

        if (visibleDataPoints.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = visibleDataPoints.map((dp, idx) => {
            const color = colors[idx % colors.length];
            return `
                <div class="legend-item">
                    <div class="legend-swatch" style="background: ${color}; opacity: 0.5; border-color: ${color};"></div>
                    <span>${dp.name}</span>
                </div>
            `;
        }).join('');
    }

    render() {
        document.getElementById('titleDisplay').textContent = this.state.chartTitle;
        document.getElementById('descDisplay').textContent = this.state.description;
        this.renderDimensions();
        this.renderDataPoints();
        this.renderColorSchemes();
        this.renderChart();
    }

    // --- Misc ---

    copyTableHTML(dimId) {
        const dim = this.state.dimensions.find(d => d.id === dimId);
        const html = `<h2>${dim.name}</h2>
${dim.description ? `<p>${dim.description}</p>` : ''}
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
<thead>
<tr>
<th style="background-color: #f0f0f0; text-align: left; padding: 8px;">Level Name</th>
<th style="background-color: #f0f0f0; text-align: left; padding: 8px;">Description</th>
</tr>
</thead>
<tbody>
${dim.levels.map(level => `<tr>
<td style="padding: 8px;">${level.name}</td>
<td style="padding: 8px;">${level.description || ''}</td>
</tr>`).join('\n')}
</tbody>
</table>`;

        navigator.clipboard.writeText(html).then(() => this.toast.show('HTML table copied!'));
    }

    copyTableLaTeX(dimId) {
        const dim = this.state.dimensions.find(d => d.id === dimId);
        const latex = `\\begin{table}[h]
\\centering
\\caption{${dim.name}${dim.description ? `: ${dim.description}` : ''}}
\\begin{tabular}{|l|p{10cm}|}
\\hline
\\textbf{Level Name} & \\textbf{Description} \\\\ \\hline
${dim.levels.map(level => `${level.name} & ${level.description || ''} \\\\ \\hline`).join('\n')}
\\end{tabular}
\\end{table}`;

        navigator.clipboard.writeText(latex).then(() => this.toast.show('LaTeX table copied!'));
    }

    generateAltText() {
        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);
        const dimList = this.state.dimensions.map(d => d.name).join(', ');

        let text = `A radar chart titled "${this.state.chartTitle}"`;
        if (this.state.description) text += ` representing ${this.state.description}`;
        text += ` displaying ${this.state.dimensions.length} dimensions: ${dimList}.`;

        if (visibleDataPoints.length > 0) {
            text += ` The chart shows ${visibleDataPoints.length} data point${visibleDataPoints.length > 1 ? 's' : ''}: `;
            text += visibleDataPoints.map(dp => {
                const values = this.state.dimensions.map(dim => {
                    const level = dim.levels[dp.values[dim.id] || 0];
                    return `${dim.name}: ${level.name}`;
                }).join(', ');
                return `${dp.name} (${values})`;
            }).join('; ');
            text += '.';
        }

        document.getElementById('altText').textContent = text;
        document.getElementById('altTextDisplay').style.display = 'block';
    }

    generateCaption() {
        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);

        let text = `Figure: ${this.state.chartTitle}.`;
        if (this.state.description) text += ` ${this.state.description}`;

        text += ' This radar chart ';

        if (visibleDataPoints.length === 0) {
            text += 'presents the design space framework';
        } else if (visibleDataPoints.length === 1) {
            text += `presents the profile of ${visibleDataPoints[0].name}`;
        } else if (visibleDataPoints.length === 2) {
            text += `compares ${visibleDataPoints.map(dp => dp.name).join(', ')}`;
        } else {
            text += `compares ${visibleDataPoints.length} configurations (${visibleDataPoints.map(dp => dp.name).join(', ')})`;
        }

        text += ` across ${this.state.dimensions.length} dimensions.`;

        document.getElementById('caption').textContent = text;
        document.getElementById('captionDisplay').style.display = 'block';
    }

    copyText(id) {
        const text = document.getElementById(id).textContent;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById(id === 'altText' ? 'btnCopyAltText' : 'btnCopyCaption');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            this.toast.show('Text copied to clipboard');
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    }

    exportJSON() {
        const config = {
            chartTitle: this.state.chartTitle,
            description: this.state.description,
            dimensions: this.state.dimensions,
            dataPoints: this.state.dataPoints,
            theme: this.state.theme
        };

        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.chartTitle.replace(/\s+/g, '_')}_config.json`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);

                // Define default theme
                const defaultTheme = {
                    width: 800,
                    height: 800,
                    showLevelLabels: true,
                    showDimensionNames: true,
                    colorScheme: 'default'
                };

                this.state = {
                    chartTitle: config.chartTitle || 'Design Space',
                    description: config.description || '',
                    dimensions: config.dimensions || [],
                    dataPoints: config.dataPoints || [],
                    theme: {
                        ...defaultTheme,
                        ...(config.theme || {})
                    }
                };

                document.getElementById('titleInput').value = this.state.chartTitle;
                document.getElementById('descInput').value = this.state.description;
                document.getElementById('titleDisplay').textContent = this.state.chartTitle;
                document.getElementById('descDisplay').textContent = this.state.description;
                document.getElementById('chartWidth').value = this.state.theme.width;
                document.getElementById('chartHeight').value = this.state.theme.height;
                document.getElementById('showLevelLabels').checked = this.state.theme.showLevelLabels;
                document.getElementById('showDimensionNames').checked = this.state.theme.showDimensionNames;

                this.saveState();
                this.render();
                this.toast.show('Configuration imported successfully!', 'success');
            } catch (error) {
                console.error(error);
                this.toast.show('Failed to import configuration. Please check the file format.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    exportSVG() {
        const container = document.getElementById('chartExport');
        const svg = container.querySelector('svg');

        if (!svg) {
            this.toast.show('Please ensure the chart has been rendered.', 'error');
            return;
        }

        const svgClone = svg.cloneNode(true);
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Add Legend to SVG for Export
        const visibleDataPoints = this.state.dataPoints.filter(dp => dp.visible);
        if (visibleDataPoints.length > 0) {
            const originalHeight = parseInt(svgClone.getAttribute('height'));
            const originalWidth = parseInt(svgClone.getAttribute('width'));
            const legendHeight = Math.ceil(visibleDataPoints.length / 2) * 30 + 40; // Estimate height
            const newHeight = originalHeight + legendHeight;

            svgClone.setAttribute('height', newHeight);
            svgClone.setAttribute('viewBox', `0 0 ${originalWidth} ${newHeight}`); // Preserve scaling if any

            const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            legendGroup.setAttribute('transform', `translate(0, ${originalHeight})`);

            const colors = this.colorSchemes[this.state.theme.colorScheme];

            visibleDataPoints.forEach((dp, idx) => {
                const color = colors[idx % colors.length];
                const x = (idx % 2) * (originalWidth / 2) + 20; // 2 columns
                const y = Math.floor(idx / 2) * 30 + 20;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', '20');
                rect.setAttribute('height', '20');
                rect.setAttribute('fill', color);
                rect.setAttribute('stroke', color);
                rect.setAttribute('rx', '4'); // Rounded corners

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x + 30);
                text.setAttribute('y', y + 15); // Vertically centered
                text.setAttribute('font-size', '14');
                text.setAttribute('fill', '#1e293b');
                text.textContent = dp.name;

                legendGroup.appendChild(rect);
                legendGroup.appendChild(text);
            });

            svgClone.appendChild(legendGroup);
        }

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgClone);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.chartTitle.replace(/\s+/g, '_')}.svg`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

}

// Start App
const app = new RadarChartApp();
