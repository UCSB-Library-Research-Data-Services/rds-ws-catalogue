// Workshop Catalogue App
class WorkshopCatalogue {
    constructor() {
        this.data = null;
        this.filteredWorkshops = [];
        this.filters = this.getFiltersFromURL();
        this.sortBy = 'date';
        this.icalGenerator = null;
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.icalGenerator = new ICalGenerator(this.data);
            this.setupEventListeners();
            this.populateFilters();
            this.filterAndDisplayWorkshops();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to load workshop data <i class="bi bi-emoji-dizzy"></i>');
        }
    }

    async loadData() {
        const response = await fetch('assets/data/workshops.json');
        if (!response.ok) throw new Error('Failed to fetch workshop data');
        this.data = await response.json();
    }

    setupEventListeners() {
        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.filterAndDisplayWorkshops();
        });

        // Filter dropdowns
        ['areaFilter', 'audienceFilter', 'formatFilter', 'departmentFilter', 'instructorFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                const filterKey = id.replace('Filter', '');
                this.filters[filterKey] = e.target.value;
                this.filterAndDisplayWorkshops();
            });
        });

        // Clear filters button
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Sort dropdown
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndDisplayWorkshops();
        });

        // Calendar subscription button
        document.getElementById('subscribeCalendar').addEventListener('click', () => {
            this.subscribeToCalendar();
        });

        document.getElementById('workshopList').addEventListener('click', (e) => {
            if (e.target.dataset.instructor) {
                const instructorFilter = document.getElementById('instructorFilter');
                instructorFilter.value = e.target.dataset.instructor;
                instructorFilter.dispatchEvent(new Event('change'));
            } else if (e.target.dataset.format) {
                const formatFilter = document.getElementById('formatFilter');
                formatFilter.value = e.target.dataset.format;
                formatFilter.dispatchEvent(new Event('change'));
            } else if (e.target.dataset.tag) {
                const searchInput = document.getElementById('searchInput');
                searchInput.value = e.target.dataset.tag;
                searchInput.dispatchEvent(new Event('input'));
            } else if (e.target.classList.contains('toggle-description')) {
                const descriptionEl = e.target.parentElement;
                const isExpanded = descriptionEl.classList.contains('expanded');
                
                if (isExpanded) {
                    descriptionEl.classList.remove('expanded');
                    descriptionEl.innerHTML = descriptionEl.dataset.truncated + ' <span class="toggle-description" title="Show more">[+]</span>';
                } else {
                    descriptionEl.classList.add('expanded');
                    descriptionEl.innerHTML = descriptionEl.dataset.full + ' <span class="toggle-description" title="Show less">[-]</span>';
                }
            }
        })
    }



    populateFilters() {
        // Populate area filter
        this.populateSelect('areaFilter', this.data.areas, 'label', 'id');

        // Populate audience filter
        this.populateSelect('audienceFilter', this.data.audiences, 'label', 'id');

        // Populate format filter
        this.populateSelect('formatFilter', this.data.formats, 'label', 'id');

        // Populate department filter
        this.populateSelect('departmentFilter', this.data.departments, 'label', 'id');

        // Populate instructor filter
        this.populateSelect('instructorFilter', this.data.instructors, 'name', 'id');

        document.getElementById('searchInput').value = this.filters.search;
        document.getElementById('areaFilter').value = this.filters.area;
        document.getElementById('audienceFilter').value = this.filters.audience;
        document.getElementById('formatFilter').value = this.filters.format;
        document.getElementById('departmentFilter').value = this.filters.department;
        document.getElementById('instructorFilter').value = this.filters.instructor;
    }

    populateSelect(elementId, items, labelKey, valueKey) {
        const select = document.getElementById(elementId);
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[labelKey];
            select.appendChild(option);
        });
    }

    clearFilters() {
        this.filters = {
            search: '',
            area: '',
            audience: '',
            format: '',
            department: '',
            instructor: ''
        };

        document.getElementById('searchInput').value = '';
        document.getElementById('areaFilter').value = '';
        document.getElementById('audienceFilter').value = '';
        document.getElementById('formatFilter').value = '';
        document.getElementById('departmentFilter').value = '';
        document.getElementById('instructorFilter').value = '';

        this.filterAndDisplayWorkshops();
    }

    filterAndDisplayWorkshops() {
        // Update URL with current filters
        this.updateURL();

        // Filter active workshops
        this.filteredWorkshops = this.data.workshops.filter(workshop => {
            if (!workshop.is_active) return false;

            // Search filter
            if (this.filters.search) {
                const searchText = `${workshop.title} ${workshop.summary} ${workshop.description} ${workshop.tags}`.toLowerCase();
                if (!searchText.includes(this.filters.search)) return false;
            }

            // Area filter
            if (this.filters.area && !workshop.area_ids.includes(this.filters.area)) return false;

            // Audience filter
            if (this.filters.audience && !workshop.audience_ids.includes(this.filters.audience)) return false;

            // Format filter
            if (this.filters.format && workshop.format_id !== this.filters.format) return false;

            // Department filter
            if (this.filters.department && !workshop.department_ids.includes(this.filters.department)) return false;

            // Instructor filter
            if (this.filters.instructor && !workshop.instructor_ids.includes(this.filters.instructor)) return false;

            return true;
        });

        // Sort workshops
        this.sortWorkshops();

        // Display workshops
        this.displayWorkshops();
        this.updateResultsCount();
    }

    sortWorkshops() {
        this.filteredWorkshops.sort((a, b) => {
            if (this.sortBy === 'date') {
                // Get the first offering for each workshop
                const offeringA = this.getFirstOffering(a);
                const offeringB = this.getFirstOffering(b);
                
                if (!offeringA) return 1;
                if (!offeringB) return -1;
                
                return new Date(offeringA.start) - new Date(offeringB.start);
            } else if (this.sortBy === 'title') {
                return a.title.localeCompare(b.title);
            }
        });
    }

    getFirstOffering(workshop) {
        const offering = this.data.offerings.find(o => o.workshop_id === workshop.id);
        return offering;
    }

    displayWorkshops() {
        const workshopList = document.getElementById('workshopList');
        
        if (this.filteredWorkshops.length === 0) {
            workshopList.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info" role="alert">
                        <i class="bi bi-info-circle"></i> No workshops found matching your criteria.
                    </div>
                </div>
            `;
            return;
        }

        workshopList.innerHTML = this.filteredWorkshops.map(workshop => 
            this.createWorkshopCard(workshop)
        ).join('');
    }

    createWorkshopCard(workshop) {
        /*this.data.formats.find(f => f.id === workshop.format_id)*/
        const format = this.data.formats.find(f => f.id === workshop.format_id);
        const formatLink = `<span class="filter-element-link" data-format="${format?.id}">${format?.label || 'Unknown Format'}</span>`;
        const areas = workshop.area_ids.map(id => 
            this.data.areas.find(a => a.id === id)?.label
        ).filter(Boolean);
        const audiences = workshop.audience_ids.map(id => 
            this.data.audiences.find(a => a.id === id)?.label
        ).filter(Boolean);
        const instructors = workshop.instructor_ids.map(id => {
            const instructor = this.data.instructors.find(i => i.id === id);
            return `<span class="filter-element-link" data-instructor="${id}">${instructor?.name || id}</span>`;
        }).join(', ');
        const tags = workshop.tags.map(tag => `<span class="badge bg-secondary me-1" style="cursor: pointer;" data-tag="${tag}">${tag}</span>`).join('');
        const offerings = this.data.offerings.filter(o => o.workshop_id === workshop.id);
        const series = workshop.series_id ? this.data.series.find(s => s.id === workshop.series_id) : null;

        // Handle description truncation
        const description = workshop.description || workshop.summary;
        const maxLength = 150;
        const needsTruncation = description.length > maxLength;
        const truncatedDesc = needsTruncation ? description.substring(0, maxLength) + '...' : description;
        const toggleButton = needsTruncation ? ' <span class="toggle-description" title="Show more">[+]</span>' : '';

        return `
            <div class="col-12 col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm workshop-card">
                    <div class="card-header bg-light">
                        <h5 class="card-title mb-1">${workshop.title}</h5>
                        ${series ? `<small class="text-muted"><i class="bi bi-collection"></i> Part of: ${series.title}</small>` : ''}
                    </div>
                    <div class="card-body">
                        <p class="card-text description-text" style="white-space: pre-line;" data-full="${description}" data-truncated="${truncatedDesc}">${truncatedDesc}${toggleButton}</p>
                        
                        <div class="mb-3">
                            <small class="text-muted d-block mb-1">
                                <i class="bi ${format?.icon || 'bi-app'}"></i> ${formatLink}
                            </small>
                            <small class="text-muted d-block mb-1">
                                <strong>Areas:</strong> ${areas.join(', ')}
                            </small>
                            <small class="text-muted d-block mb-1">
                                <strong>Audience:</strong> ${audiences.join(', ')}
                            </small>
                            <small class="text-muted d-block mb-1">
                                <strong>Instructors:</strong> ${instructors}
                            </small>
                        </div>

                        ${this.createOfferingsSection(offerings)}

                        <div class="mt-2">
                            ${tags}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createOfferingsSection(offerings) {
        if (offerings.length === 0) {
            return '<p class="text-muted mb-2"><small>No upcoming sessions scheduled</small></p>';
        }

        return `
            <div class="offerings mb-2">
                <strong class="d-block mb-2"><i class="bi bi-calendar-event"></i> Upcoming Sessions:</strong>
                ${offerings.map(offering => {
                    const date = new Date(offering.start);
                    const endDate = new Date(offering.end);
                    return `
                        <div class="offering-item mb-2 p-2 border rounded bg-light">
                            <small class="d-block">
                                <strong>${date.toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                })}</strong>
                            </small>
                            <small class="d-block text-muted">
                                ${date.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })} - ${endDate.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}
                            </small>
                            <small class="d-block text-muted">
                                <i class="bi bi-geo-alt"></i> ${offering.location}
                            </small>
                            <small class="d-block text-muted">
                                <i class="bi bi-person-check"></i> Capacity: ${offering.capacity}
                            </small>
                            <div class="mt-2 d-flex gap-1 flex-wrap">
                                ${offering.registration_url ? 
                                    `<a href="${offering.registration_url}" class="btn btn-sm btn-primary" target="_blank">
                                        <i class="bi bi-box-arrow-up-right"></i> Register
                                    </a>` : `<a href="#" class="btn btn-sm btn-secondary disabled">
                                        <i class="bi bi-hourglass-split"></i> Opens soon
                                    </a>`
                                }
                                ${this.createAddToCalendarButton(offering)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    createAddToCalendarButton(offering) {
        // Find the workshop for this offering
        const workshop = this.data.workshops.find(w => w.id === offering.workshop_id);
        if (!workshop) return '';

        // Build event description
        const format = this.data.formats.find(f => f.id === workshop.format_id);
        const instructors = workshop.instructor_ids.map(id => 
            this.data.instructors.find(i => i.id === id)?.name
        ).filter(Boolean).join(', ');
        
        let description = workshop.description || workshop.summary || '';
        description += '\n\n---\n';
        if (format) description += `Format: ${format.label}\n`;
        if (instructors) description += `Instructor(s): ${instructors}\n`;
        if (offering.registration_url) description += `\nRegister: ${offering.registration_url}`;

        const event = {
            title: workshop.title,
            description: description,
            location: offering.location || 'TBA',
            start: new Date(offering.start),
            end: new Date(offering.end),
            url: offering.registration_url || ''
        };

        return AddToCalendar.createDropdownButton(event, 'btn-sm btn-outline-secondary');
    }

    updateResultsCount() {
        const count = this.filteredWorkshops.length;
        const total = this.data.workshops.filter(w => w.is_active).length;
        document.getElementById('resultsCount').textContent = 
            `Showing ${count} of ${total} workshop${total !== 1 ? 's' : ''}`;
    }

    showError(message) {
        const workshopList = document.getElementById('workshopList');
        workshopList.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle"></i> ${message}
                </div>
            </div>
        `;
    }

    getFiltersFromURL() {
        const params = new URLSearchParams(window.location.search);

        return {
            search: params.get('search') || '',
            area: params.get('area') || '',
            audience: params.get('audience') || '',
            format: params.get('format') || '',
            department: params.get('department') || '',
            instructor: params.get('instructor') || ''
        };
    }
    
    updateURL() {
        const params = new URLSearchParams();

        Object.keys(this.filters).forEach(key => {
            if (this.filters[key]) {
                params.set(key, this.filters[key]);
            }
        });

        const newURL = params.toString() 
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.pushState({}, '', newURL);
    }

    /**
     * Subscribe to calendar with current filters
     * Opens calendar app with subscription prompt
     */
    subscribeToCalendar() {
        if (this.filteredWorkshops.length === 0) {
            alert('No workshops match your current filters. Please adjust your filters and try again.');
            return;
        }

        // For GitHub Pages deployment, we'll generate a static ICS file
        // The URL pattern will be: /calendars/filter-{hash}.ics
        // For now, we'll just download the ICS file
        // In production with serverless, this would open a webcal:// URL
        
        const filterHash = this.getFilterHash();
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        const icsUrl = `${baseUrl}calendars/${filterHash}.ics`;
        
        // Check if we have a serverless endpoint or static files
        // For now, we'll show instructions and download
        this.showSubscriptionModal(icsUrl);
    }

    /**
     * Download ICS file for current filtered workshops
     */
    downloadICS() {
        if (this.filteredWorkshops.length === 0) {
            alert('No workshops match your current filters. Please adjust your filters and try again.');
            return;
        }

        const icsContent = this.icalGenerator.generate(this.filteredWorkshops);
        const filename = this.generateFilename();
        
        ICalGenerator.downloadICS(icsContent, filename);
    }

    /**
     * Generate a descriptive filename based on current filters
     * @returns {string} Filename for ICS file
     */
    generateFilename() {
        let parts = ['rds-workshops'];
        
        if (this.filters.area) {
            const area = this.data.areas.find(a => a.id === this.filters.area);
            if (area) parts.push(area.label.toLowerCase().replace(/\s+/g, '-'));
        }
        
        if (this.filters.format) {
            const format = this.data.formats.find(f => f.id === this.filters.format);
            if (format) parts.push(format.label.toLowerCase().replace(/\s+/g, '-'));
        }
        
        if (this.filters.audience) {
            const audience = this.data.audiences.find(a => a.id === this.filters.audience);
            if (audience) parts.push(audience.label.toLowerCase().replace(/\s+/g, '-'));
        }
        
        return parts.join('-') + '.ics';
    }

    /**
     * Generate a hash for current filter state
     * @returns {string} Filter hash
     */
    getFilterHash() {
        const filterString = JSON.stringify(this.filters);
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < filterString.length; i++) {
            const char = filterString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Show modal with subscription instructions
     * @param {string} icsUrl - URL to the ICS file
     */
    showSubscriptionModal(icsUrl) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="bi bi-bell"></i> Get Calendar Reminders</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Don't miss these workshops!</strong></p>
                        <p>Download a calendar file with automatic reminders so you don't forget to attend.</p>

                        <p class="mb-2"><strong>How to import to your calendar:</strong></p>
                        <ul class="small">
                            <li><strong><i class="bi bi-google"></i> Google Calendar:</strong> Settings → Import & Export → Import</li>
                            <li><strong><i class="bi bi-apple"></i> Apple Calendar:</strong> Double-click the downloaded file</li>
                            <li><strong><i class="bi bi-microsoft"></i> Outlook:</strong> File → Open & Export → Import/Export</li>
                        </ul>

                        <div class="alert alert-info mt-3 mb-0">
                            <i class="bi bi-funnel"></i> 
                            <strong>Workshops included:</strong><br>
                            ${this.getFilterSummary()}
                            <div class="mt-2 small text-muted">
                                (${this.filteredWorkshops.length} workshop${this.filteredWorkshops.length !== 1 ? 's' : ''})
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="downloadFromModal">
                            <i class="bi bi-download"></i> Download Calendar File
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Handle download from modal
        modal.querySelector('#downloadFromModal').addEventListener('click', () => {
            this.downloadICS();
            bootstrapModal.hide();
        });
        
        // Clean up modal after hiding
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    /**
     * Get a human-readable summary of current filters
     * @returns {string} Filter summary HTML
     */
    getFilterSummary() {
        const active = [];
        
        if (this.filters.search) {
            active.push(`Search: "${this.filters.search}"`);
        }
        if (this.filters.area) {
            const area = this.data.areas.find(a => a.id === this.filters.area);
            if (area) active.push(`Area: ${area.label}`);
        }
        if (this.filters.audience) {
            const audience = this.data.audiences.find(a => a.id === this.filters.audience);
            if (audience) active.push(`Audience: ${audience.label}`);
        }
        if (this.filters.format) {
            const format = this.data.formats.find(f => f.id === this.filters.format);
            if (format) active.push(`Format: ${format.label}`);
        }
        if (this.filters.department) {
            const dept = this.data.departments.find(d => d.id === this.filters.department);
            if (dept) active.push(`Department: ${dept.label}`);
        }
        if (this.filters.instructor) {
            const instructor = this.data.instructors.find(i => i.id === this.filters.instructor);
            if (instructor) active.push(`Instructor: ${instructor.name}`);
        }
        
        return active.length > 0 ? active.join('<br>') : 'No filters applied (all workshops)';
    }

}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WorkshopCatalogue();
});
