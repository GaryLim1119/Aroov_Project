let calendarInstance = null;
let selectedDates = null; // Store dates from drag selection

document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. MOBILE MENU TOGGLE (Matches your Navbar)
    // ==========================================
    const menuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links-container');
    const navUserImg = document.getElementById('navUserImg');
    const navUserName = document.getElementById('navUserName');

    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active'); // Toggles the slide-down menu
            menuBtn.classList.toggle('is-active'); // Toggles the X animation
        });
    }

    // ==========================================
    // 2. MODERN UNIVERSITY SELECT (Searchable Div)
    // ==========================================
    const uniTrigger = document.getElementById('uni-dropdown-trigger');
    const uniList = document.getElementById('uni-dropdown-list');
    const uniSearch = document.getElementById('uni-search');
    const uniContainer = document.getElementById('uni-options-container');
    const uniHiddenInput = document.getElementById('university-id');
    const uniDisplayText = document.getElementById('uni-selected-text');

    // Example List - In a real app, you might fetch this from /api/universities
    const universities = [
        { id: 1, name: "Taylor's University" },
        { id: 2, name: "Sunway University" },
        { id: 3, name: "Monash University" },
        { id: 4, name: "APU (Asia Pacific University)" },
        { id: 5, name: "University of Malaya (UM)" },
        { id: 6, name: "UCSI University" },
        { id: 7, name: "UiTM" },
        { id: 8, name: "University of Nottingham" }
    ];

    function renderUniversities(filterText = '') {
        uniContainer.innerHTML = '';
        const filtered = universities.filter(u => 
            u.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach(uni => {
            const div = document.createElement('div');
            div.className = 'uni-option'; // Matches CSS
            div.textContent = uni.name;
            div.onclick = () => selectUniversity(uni.id, uni.name);
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
        uniList.classList.add('hidden'); // Close dropdown
    }

    // Toggle Dropdown
    if (uniTrigger) {
        uniTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            uniList.classList.toggle('hidden');
            if (!uniList.classList.contains('hidden')) {
                uniSearch.value = '';
                renderUniversities();
                uniSearch.focus();
            }
        });
    }

    // Close when clicking outside
    document.addEventListener('click', () => {
        if(uniList) uniList.classList.add('hidden');
    });
    if(uniSearch) uniSearch.addEventListener('click', (e) => e.stopPropagation());
    if(uniSearch) uniSearch.addEventListener('input', (e) => renderUniversities(e.target.value));


    // ==========================================
    // 3. ACTIVITY TAGS LOGIC
    // ==========================================
    const tagBtns = document.querySelectorAll('.tag-btn');
    const activitiesInput = document.getElementById('activities-input');

    tagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('selected'); // Matches CSS .selected
            updateActivitiesInput();
        });
    });

    function updateActivitiesInput() {
        // Gather all selected data-val attributes
        const selected = Array.from(document.querySelectorAll('.tag-btn.selected'))
                              .map(btn => btn.dataset.val);
        activitiesInput.value = selected.join(',');
    }

    // ==========================================
    // 4. CALENDAR & AVAILABILITY
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
        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next'
        },
        events: '/api/user/calendar', // Checks your server for saved dates

        // 1. User drags to select dates
        select: function(info) {
            currentSelection = info;
            // Format date for display (FullCalendar end date is exclusive, so we subtract 1 day for visual)
            let endDate = new Date(info.endStr);
            endDate.setDate(endDate.getDate() - 1);
            
            modalRange.innerText = `${info.startStr} to ${endDate.toISOString().split('T')[0]}`;
            modal.classList.remove('hidden');
        },

        // 2. User clicks an event to delete
        eventClick: async function(info) {
            if (info.event.extendedProps.type === 'user_avail') {
                if (confirm(`Remove availability for "${info.event.title}"?`)) {
                    await fetch(`/api/user/availability/${info.event.id}`, { method: 'DELETE' });
                    info.event.remove();
                }
            }
        }
    });

    calendar.render();

    // Close Modal
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            calendar.unselect();
        });
    }

    // SAVE Button Logic
    if(saveAvailBtn) {
        saveAvailBtn.addEventListener('click', async () => {
            if (!currentSelection) return;

            const payload = {
                start_date: currentSelection.startStr,
                end_date: currentSelection.endStr,
                note: noteInput.value
            };

            // Visual Feedback
            saveAvailBtn.innerText = "Saving...";
            
            try {
                const res = await fetch('/api/user/availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    calendar.refetchEvents(); // Reload calendar events
                    modal.classList.add('hidden');
                    noteInput.value = '';
                } else {
                    alert("Failed to save. Please try again.");
                }
            } catch (err) {
                console.error(err);
                alert("Server error.");
            } finally {
                saveAvailBtn.innerText = "Confirm";
            }
        });
    }

    // ==========================================
    // 5. SAVE PROFILE FORM
    // ==========================================
    const profileForm = document.getElementById('profile-form');

    if(profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = profileForm.querySelector('button[type="submit"]');
            btn.innerText = "Saving...";
            btn.disabled = true;

            const formData = {
                name: document.getElementById('display-name').value,
                university_id: document.getElementById('university-id').value,
                activities: document.getElementById('activities-input').value
            };

            try {
                const res = await fetch('/api/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (res.ok) {
                    alert('Profile updated successfully!');
                    if(navUserName) navUserName.textContent = formData.name;
                } else {
                    alert('Error saving profile.');
                }
            } catch (err) {
                console.error(err);
                alert('Connection error.');
            } finally {
                btn.innerText = "Save Profile";
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // 6. IMAGE PREVIEW
    // ==========================================
    const fileInput = document.getElementById('profile-upload');
    const previewImg = document.getElementById('profile-pic-preview');

    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => previewImg.src = e.target.result;
                reader.readAsDataURL(file);
            }
        });
    }

    // ==========================================
    // 7. LOAD INITIAL DATA
    // ==========================================
    async function loadData() {
        try {
            const res = await fetch('/api/user/me');
            if(res.ok) {
                const data = await res.json();
                
                // Navbar & Fields
                if(data.name) {
                    document.getElementById('display-name').value = data.name;
                    if(navUserName) navUserName.textContent = data.name;
                }
                if(data.picture) {
                    if(navUserImg) navUserImg.src = data.picture;
                    if(previewImg) previewImg.src = data.picture;
                }
                
                // Set University
                if(data.university_id) {
                    const uni = universities.find(u => u.id == data.university_id);
                    if(uni) selectUniversity(uni.id, uni.name);
                }

                // Set Tags
                if(data.activities) {
                    const savedTags = data.activities.split(',');
                    tagBtns.forEach(btn => {
                        if(savedTags.includes(btn.dataset.val)) {
                            btn.classList.add('selected');
                        }
                    });
                    updateActivitiesInput();
                }
            }
        } catch(e) {
            console.log("Error loading profile");
        }
    }

    loadData();
});