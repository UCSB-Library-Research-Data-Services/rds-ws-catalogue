// Add to Calendar Helper
// Generates URLs for adding events to various calendar services

class AddToCalendar {
    /**
     * Generate "Add to Calendar" URLs for multiple services
     * @param {Object} event - Event details
     * @param {string} event.title - Event title
     * @param {string} event.description - Event description
     * @param {string} event.location - Event location
     * @param {Date} event.start - Start date/time
     * @param {Date} event.end - End date/time
     * @param {string} event.url - Event URL (optional)
     * @returns {Object} URLs for different calendar services
     */
    static generateLinks(event) {
        return {
            google: this.generateGoogleCalendarUrl(event),
            apple: this.generateICalUrl(event),
            outlook: this.generateOutlookUrl(event),
            office365: this.generateOffice365Url(event),
            yahoo: this.generateYahooUrl(event)
        };
    }

    /**
     * Generate Google Calendar URL
     * Note: Google Calendar template links don't support custom reminders.
     * The event will use the user's default calendar reminder settings.
     */
    static generateGoogleCalendarUrl(event) {
        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: event.title,
            details: event.description || '',
            location: event.location || '',
            dates: `${this.formatGoogleDate(event.start)}/${this.formatGoogleDate(event.end)}`
        });

        if (event.url) {
            params.set('details', `${event.description || ''}\n\nMore info: ${event.url}`);
        }

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    /**
     * Generate iCalendar (.ics) URL for Apple Calendar, Outlook, etc.
     */
    static generateICalUrl(event) {
        const icsContent = this.generateICS(event);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        return URL.createObjectURL(blob);
    }

    /**
     * Generate Outlook.com URL
     */
    static generateOutlookUrl(event) {
        const params = new URLSearchParams({
            path: '/calendar/action/compose',
            rru: 'addevent',
            subject: event.title,
            body: event.description || '',
            location: event.location || '',
            startdt: event.start.toISOString(),
            enddt: event.end.toISOString()
        });

        return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    }

    /**
     * Generate Office 365 URL
     */
    static generateOffice365Url(event) {
        const params = new URLSearchParams({
            path: '/calendar/action/compose',
            rru: 'addevent',
            subject: event.title,
            body: event.description || '',
            location: event.location || '',
            startdt: event.start.toISOString(),
            enddt: event.end.toISOString()
        });

        return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
    }

    /**
     * Generate Yahoo Calendar URL
     */
    static generateYahooUrl(event) {
        const duration = Math.floor((event.end - event.start) / (1000 * 60)); // duration in minutes
        
        const params = new URLSearchParams({
            v: '60',
            title: event.title,
            desc: event.description || '',
            in_loc: event.location || '',
            st: this.formatYahooDate(event.start),
            dur: this.formatDuration(duration)
        });

        return `https://calendar.yahoo.com/?${params.toString()}`;
    }

    /**
     * Format date for Google Calendar (YYYYMMDDTHHMMSSZ)
     */
    static formatGoogleDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    /**
     * Format date for Yahoo Calendar (YYYYMMDDTHHMMSSZ)
     */
    static formatYahooDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    /**
     * Format duration for Yahoo Calendar (HHMM)
     */
    static formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
    }

    /**
     * Generate ICS file content for a single event
     */
    static generateICS(event) {
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}${seconds}`;
        };

        const escapeText = (text) => {
            if (!text) return '';
            return text
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
        };

        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//UCSB Library//RDS Workshops//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${Date.now()}@rds-workshops.ucsb.edu
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${escapeText(event.title)}
DESCRIPTION:${escapeText(event.description)}
LOCATION:${escapeText(event.location)}${event.url ? '\nURL:' + event.url : ''}
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${escapeText(event.title)} tomorrow
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${escapeText(event.title)} in 1 hour
END:VALARM
END:VEVENT
END:VCALENDAR`;
    }

    /**
     * Create a dropdown button with links to multiple calendar services
     * @param {Object} event - Event details
     * @param {string} buttonClass - Additional CSS classes for the button
     * @returns {string} HTML for dropdown button
     */
    static createDropdownButton(event, buttonClass = 'btn-sm btn-outline-primary') {
        const links = this.generateLinks(event);
        const dropdownId = `calendar-dropdown-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="btn-group">
                <button type="button" class="btn ${buttonClass} dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-bell"></i> Remind Me
                </button>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="${links.google}" target="_blank" rel="noopener">
                        <i class="bi bi-google"></i> Google Calendar
                    </a></li>
                    <li><a class="dropdown-item add-to-apple-calendar" href="#" data-event='${JSON.stringify(event).replace(/'/g, "&apos;")}'>
                        <i class="bi bi-apple"></i> Apple Calendar
                    </a></li>
                    <li><a class="dropdown-item" href="${links.outlook}" target="_blank" rel="noopener">
                        <i class="bi bi-microsoft"></i> Outlook
                    </a></li>
                </ul>
            </div>
        `;
    }

    /**
     * Handle download of ICS file for Apple Calendar and other clients
     * @param {Object} event - Event details
     * @param {string} filename - Filename for download
     */
    static downloadICS(event, filename = 'event.ics') {
        const icsContent = this.generateICS(event);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Initialize event listeners for Apple Calendar links
     */
    static initializeListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-apple-calendar')) {
                e.preventDefault();
                const link = e.target.closest('.add-to-apple-calendar');
                const eventData = JSON.parse(link.dataset.event);
                
                // Convert ISO strings back to Date objects
                eventData.start = new Date(eventData.start);
                eventData.end = new Date(eventData.end);
                
                this.downloadICS(eventData, 'workshop.ics');
            }
        });
    }
}

// Initialize listeners when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        AddToCalendar.initializeListeners();
    });
}
