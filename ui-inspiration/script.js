document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('video-upload');
    const uploadContent = document.querySelector('.upload-content');
    const filePreview = document.getElementById('file-preview');
    const fileNameEl = document.getElementById('file-name');
    const fileSizeEl = document.getElementById('file-size');
    const removeBtn = document.getElementById('remove-file');

    const analyzeBtn = document.getElementById('analyze-btn');
    const processingOverlay = document.getElementById('processing-overlay');
    const progressFill = document.querySelector('.progress-fill');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    let uploadedFile = null;

    // --- Tab Switching Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Add active class to clicked
            btn.classList.add('active');
            const targetPane = document.getElementById(btn.dataset.target);
            targetPane.classList.add('active');

            // Validate state on tab change
            validateState();
        });
    });

    // --- Nav Links Interaction (Verify) ---
    const navLinksItems = document.querySelectorAll('.nav-links a');
    navLinksItems.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinksItems.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            alert(`Navigating to ${link.textContent.trim()} section. (Scrolling simulated)`);
        });
    });

    // --- File Upload Logic ---

    // Click to upload
    dropZone.addEventListener('click', (e) => {
        if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    // Prevent defaults for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Add visual cues for drag
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Handle Drop
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // Handle Input Change
    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];

            // Check if it's a video
            if (file.type.startsWith('video/')) {
                uploadedFile = file;
                const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

                fileNameEl.textContent = file.name;
                fileSizeEl.textContent = `${sizeInMB} MB`;

                // Toggle UI
                uploadContent.classList.add('hidden');
                uploadContent.style.display = 'none';
                filePreview.classList.remove('hidden');

                validateState();
            } else {
                alert('Please upload a valid video file format (MP4, MOV, AVI).');
            }
        }
    }

    // Remove file
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent triggering file input click
        uploadedFile = null;
        fileInput.value = ''; // clear input

        // Toggle UI
        filePreview.classList.add('hidden');
        uploadContent.classList.remove('hidden');
        uploadContent.style.display = 'block';

        validateState();
    });

    // --- Validation & Analysis Logic ---

    // Initial listener attachments
    const schemaContainer = document.getElementById('schema-rows-container');
    const addRowBtn = document.getElementById('add-schema-row');

    function createSchemaRow() {
        const row = document.createElement('div');
        row.className = 'schema-row';
        row.innerHTML = `
            <input type="text" class="schema-field" placeholder="e.g. key_events" required>
            <select class="schema-type">
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="array">Array</option>
                <option value="object">Object</option>
            </select>
            <input type="text" class="schema-desc" placeholder="e.g. List of all major events" required>
            <button class="remove-row-btn" title="Remove Field"><i class="fa-solid fa-xmark"></i></button>
        `;

        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => input.addEventListener('input', validateState));

        row.querySelector('.remove-row-btn').addEventListener('click', () => {
            row.remove();
            validateState();
        });

        return row;
    }

    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            schemaContainer.appendChild(createSchemaRow());
            validateState();
            // Scroll to bottom
            schemaContainer.scrollTop = schemaContainer.scrollHeight;
        });
    }

    if (schemaContainer) {
        const initialInputs = schemaContainer.querySelectorAll('input, select');
        initialInputs.forEach(input => input.addEventListener('input', validateState));

        const initialRemoveBtn = schemaContainer.querySelector('.remove-row-btn');
        if (initialRemoveBtn) {
            initialRemoveBtn.addEventListener('click', function (e) {
                e.target.closest('.schema-row').remove();
                validateState();
            });
        }
    }

    function validateState() {
        // Must have file
        if (!uploadedFile) {
            analyzeBtn.disabled = true;
            return;
        }

        const activeTab = document.querySelector('.tab-btn.active').dataset.target;

        if (activeTab === 'templates-tab') {
            analyzeBtn.disabled = false;
        } else if (activeTab === 'custom-tab') {
            const rows = document.querySelectorAll('.schema-row');

            if (rows.length === 0) {
                analyzeBtn.disabled = true;
                return;
            }

            let isValid = true;
            rows.forEach(row => {
                const fieldName = row.querySelector('.schema-field').value.trim();
                const fieldDesc = row.querySelector('.schema-desc').value.trim();

                if (!fieldName || !fieldDesc) {
                    isValid = false;
                }
            });

            analyzeBtn.disabled = !isValid;
        }
    }

    // Handle Analysis Simulation
    analyzeBtn.addEventListener('click', () => {
        if (analyzeBtn.disabled) return;

        // Show overlay
        processingOverlay.classList.remove('hidden');

        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 99) progress = 99;
            progressFill.style.width = `${progress}%`;
        }, 800);

        // Simulate complete backend response after 8 seconds
        setTimeout(() => {
            clearInterval(interval);
            progressFill.style.width = '100%';

            setTimeout(() => {
                alert('Analysis complete! (Simulation ended - backend connection needed to show real results)');
                processingOverlay.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 500);

        }, 6000);
    });
});
