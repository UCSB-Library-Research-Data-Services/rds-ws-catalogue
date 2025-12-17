// Workshop Catalogue App
class WorkshopCatalogue {
    constructor() {
        this.data = null;
        this.filteredWorkshops = [];
        this.filters = {
            search: '',
            area: '',
            audience: '',
            format: '',
            department: '',
            instructor: ''
        };
        this.sortBy = 'date';
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.populateFilters();
            this.filterAndDisplayWorkshops();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to load workshop data. Please refresh the page.');
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

        document.getElementById('workshopList').addEventListener('click', (e) => {
            if (e.target.dataset.instructor) {
                const instructorFilter = document.getElementById('instructorFilter');
                instructorFilter.value = e.target.dataset.instructor;
                instructorFilter.dispatchEvent(new Event('change'));
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
        // Filter active workshops
        this.filteredWorkshops = this.data.workshops.filter(workshop => {
            if (!workshop.is_active) return false;

            // Search filter
            if (this.filters.search) {
                const searchText = `${workshop.title} ${workshop.summary} ${workshop.description}`.toLowerCase();
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
        const format = this.data.formats.find(f => f.id === workshop.format_id);
        const areas = workshop.area_ids.map(id => 
            this.data.areas.find(a => a.id === id)?.label
        ).filter(Boolean);
        const audiences = workshop.audience_ids.map(id => 
            this.data.audiences.find(a => a.id === id)?.label
        ).filter(Boolean);
        const instructors = workshop.instructor_ids.map(id => {
            const instructor = this.data.instructors.find(i => i.id === id);
            return `<span class="instructor-link" data-instructor="${id}">${instructor?.name || id}</span>`;
        }).join(', ');
        const offerings = this.data.offerings.filter(o => o.workshop_id === workshop.id);
        const series = workshop.series_id ? this.data.series.find(s => s.id === workshop.series_id) : null;

        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm workshop-card">
                    <div class="card-header bg-light">
                        <h5 class="card-title mb-1">${workshop.title}</h5>
                        ${series ? `<small class="text-muted"><i class="bi bi-collection"></i> Part of: ${series.title}</small>` : ''}
                    </div>
                    <div class="card-body">
                        <p class="card-text">${workshop.summary}</p>
                        
                        <div class="mb-3">
                            <small class="text-muted d-block mb-1">
                                <i class="bi bi-laptop"></i> <strong>Format:</strong> <i class="bi ${format?.icon || 'bi-app'}"></i>
                            </small>
                            <small class="text-muted d-block mb-1">
                                <i class="bi bi-diagram-3"></i> <strong>Areas:</strong> ${areas.join(', ')}
                            </small>
                            <small class="text-muted d-block mb-1">
                                <i class="bi bi-people"></i> <strong>Audience:</strong> ${audiences.join(', ')}
                            </small>
                            <small class="text-muted d-block mb-1">
                                <i class="bi bi-person-badge"></i> <strong>Instructors:</strong> ${instructors}
                            </small>
                        </div>

                        ${this.createOfferingsSection(offerings)}

                        <div class="mt-2">
                            ${workshop.tags.map(tag => 
                                `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`
                            ).join('')}
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
                            ${offering.registration_url ? 
                                `<a href="${offering.registration_url}" class="btn btn-sm btn-primary mt-1" target="_blank">
                                    <i class="bi bi-box-arrow-up-right"></i> Register
                                </a>` : ''
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        `;
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
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WorkshopCatalogue();
});
