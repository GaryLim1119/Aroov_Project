let calendarInstance = null;
let selectedDates = null; // Store dates from drag selection

document.addEventListener('DOMContentLoaded', function() {
    
    // Global variable to store fetched universities
    let allUniversities = [];

    // ==========================================
    // 1. MOBILE MENU TOGGLE
    // ==========================================
    const menuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links-container');

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuBtn.classList.toggle('is-active');
        });
    }

    // ==========================================
    // 2. FETCH UNIVERSITIES FROM DB (Dynamic)
    // ==========================================
    const uniTrigger = document.getElementById('uni-dropdown-trigger');
    const uniList = document.getElementById('uni-dropdown-list');
    const uniSearch = document.getElementById('uni-search');
    const uniContainer = document.getElementById('uni-options-container');
    const uniHiddenInput = document.getElementById('university-id');
    const uniDisplayText = document.getElementById('uni-selected-text');

    async function loadUniversities() {
        try {
            // CALL YOUR API ENDPOINT HERE
            const res = await fetch('/api/universities'); 
            if (!res.ok) throw new Error("Failed to load universities");
            
            allUniversities = await res.json(); // Store in global variable
            renderUniversities(); // Render initial list
        } catch (err) {
            console.error(err);
            uniContainer.innerHTML = '<div class="p-3 text-red-500 text-sm">Error loading universities</div>';
        }
    }

    function renderUniversities(filterText = '') {
        uniContainer.innerHTML = '';
        
        const filtered = allUniversities.filter(u => 
            u.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach(uni => {
            const div = document.createElement('div');
            div.className = 'uni-option';
            div.textContent = uni.name;
            // Assuming your DB returns 'id' and 'name'
            div.onclick = () => selectUniversity(uni.id || uni.university_id, uni.name);
            uniContainer.appendChild(div);
        });

        if (filtered.length === 0) {
            uniContainer.innerHTML = '<div class="p-3 text-sm text-gray-400 text-center">No results found</div>';
        }
    }

    function selectUniversity(id, name) {
        uniHiddenInput.value = id;
        uniDisplayText.textContent = name;
        uniDisplayText.classList.remove('text-gray-500');
        uniDisplayText.classList.add('text-gray-800', 'font-medium');
        uniList.classList.add('hidden'); 
    }

    // Dropdown Event Listeners
    if (uniTrigger) {
        uniTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            uniList.classList.toggle('hidden');
            if (!uniList.classList.contains('hidden')) {
                uniSearch.value = '';
                renderUniversities(); // Show all
                uniSearch.focus();
            }
        });
    }

    document.addEventListener('click', () => { if(uniList) uniList.classList.add('hidden'); });
    if(uniSearch) {
        uniSearch.addEventListener('click', (e) => e.stopPropagation());
        uniSearch.addEventListener('input', (e) => renderUniversities(e.target.value));
    }

    // ==========================================
    // 3. TAGS LOGIC (Travel Types & Activities)
    // ==========================================
    function setupTagGroup(btnClass, inputId) {
        const btns = document.querySelectorAll(btnClass);
        const input = document.getElementById(inputId);

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
                // Gather all selected IDs/Names
                const selected = Array.from(document.querySelectorAll(`${btnClass}.selected`))
                                      .map(b => b.dataset.val);
                input.value = selected.join(',');
            });
        });
    }

    setupTagGroup('.type-btn', 'types-input');       // Destination Types
    setupTagGroup('.act-btn', 'activities-input');   // Activities

    // ==========================================
    // 4. CALENDAR LOGIC
    // ==========================================
    const calendarEl = document.getElementById('calendar');
    const modal = document.getElementById('event-modal');
    const modalRange = document.getElementById('modal-date-range');
    const noteInput = document.getElementById('event-note');
    const saveAvailBtn = document.getElementById('save-avail-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    let currentSelection = null; 

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        selectable: true,
        headerToolbar: { left: 'prev', center: 'title', right: 'next' },
        events: '/api/user/calendar',
        select: function(info) {
            currentSelection = info;
            let endDate = new Date(info.endStr);
            endDate.setDate(endDate.getDate() - 1);
            modalRange.innerText = `${info.startStr} to ${endDate.toISOString().split('T')[0]}`;
            modal.classList.remove('hidden');
        },
        eventClick: async function(info) {
            if (info.event.extendedProps.type === 'user_avail') {
                if (confirm('Remove availability?')) {
                    await fetch(`/api/user/availability/${info.event.id}`, { method: 'DELETE' });
                    info.event.remove();
                }
            }
        }
    });
    calendar.render();

    if(closeModalBtn) closeModalBtn.addEventListener('click', () => { modal.classList.add('hidden'); calendar.unselect(); });

    if(saveAvailBtn) {
        saveAvailBtn.addEventListener('click', async () => {
            if (!currentSelection) return;
            try {
                const res = await fetch('/api/user/availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        start_date: currentSelection.startStr,
                        end_date: currentSelection.endStr,
                        note: noteInput.value
                    })
                });
                if(res.ok) { calendar.refetchEvents(); modal.classList.add('hidden'); noteInput.value=''; }
            } catch(e) { console.error(e); }
        });
    }

    // ==========================================
    // 5. SAVE PROFILE (With Better Error Log)
    // ==========================================
    const profileForm = document.getElementById('profile-form');

    if(profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = profileForm.querySelector('button[type="submit"]');
            btn.innerText = "Saving...";
            btn.disabled = true;

            const payload = {
                name: document.getElementById('display-name').value,
                university_id: document.getElementById('university-id').value,
                // These must match your Database Column Names exactly
                preferred_types: document.getElementById('types-input').value, 
                preferred_activities: document.getElementById('activities-input').value
            };

            console.log("Sending Payload:", payload); // Debugging line

            try {
                const res = await fetch('/api/user/profile', {
                    method: 'POST', // Make sure your server accepts POST here
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert('Profile updated successfully!');
                    const navName = document.getElementById('navUserName');
                    if(navName) navName.textContent = payload.name;
                } else {
                    // READ THE ERROR FROM SERVER
                    const errorText = await res.text();
                    console.error("Server Error:", errorText);
                    alert("Error saving: " + errorText);
                }
            } catch (err) {
                console.error(err);
                alert('Network connection error.');
            } finally {
                btn.innerText = "Save Profile";
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // 6. CHANGE PASSWORD
    // ==========================================
    const passForm = document.getElementById('password-form');
    if(passForm) {
        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = document.getElementById('new-password').value;
            const p2 = document.getElementById('confirm-password').value;

            if(p1.length < 6) return alert("Password too short");
            if(p1 !== p2) return alert("Passwords do not match");

            try {
                const res = await fetch('/api/user/password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ password: p1 })
                });
                if(res.ok) { alert("Password changed!"); passForm.reset(); }
                else alert("Failed to change password");
            } catch(e) { console.error(e); }
        });
    }

    // ==========================================
    // 7. INITIAL DATA LOAD
    // ==========================================
    const fileInput = document.getElementById('profile-upload');
    const previewImg = document.getElementById('profile-pic-preview');

    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = (e) => previewImg.src = e.target.result;
                reader.readAsDataURL(file);
            }
        });
    }

    async function loadData() {
        // 1. Load Universities FIRST
        await loadUniversities(); 

        // 2. Load User Data
        try {
            const res = await fetch('/api/user/me');
            if(res.ok) {
                const data = await res.json();
                
                // Name & Pic
                if(data.name) {
                    document.getElementById('display-name').value = data.name;
                    document.getElementById('navUserName').textContent = data.name;
                }
                if(data.picture) {
                    document.getElementById('navUserImg').src = data.picture;
                    previewImg.src = data.picture;
                }

                // University (Must match ID from the fetched list)
                if(data.university_id) {
                    const uni = allUniversities.find(u => u.id == data.university_id || u.university_id == data.university_id);
                    if(uni) {
                        selectUniversity(uni.id || uni.university_id, uni.name);
                    }
                }

                // Restore Types
                if(data.preferred_types) {
                    const types = data.preferred_types.split(',');
                    document.querySelectorAll('.type-btn').forEach(btn => {
                        if(types.includes(btn.dataset.val)) btn.classList.add('selected');
                    });
                    document.getElementById('types-input').value = data.preferred_types;
                }

                // Restore Activities
                if(data.preferred_activities) {
                    const acts = data.preferred_activities.split(',');
                    document.querySelectorAll('.act-btn').forEach(btn => {
                        if(acts.includes(btn.dataset.val)) btn.classList.add('selected');
                    });
                    document.getElementById('activities-input').value = data.preferred_activities;
                }
            }
        } catch(e) { console.log("Error loading user profile", e); }
    }

    loadData();
});