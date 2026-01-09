// ICS/iCalendar Generator for Workshops
class ICalGenerator {
    constructor(data) {
        this.data = data;
    }

    /**
     * Generate ICS file content for filtered workshops
     * @param {Array} workshops - Filtered workshop list
     * @returns {string} ICS formatted string
     */
    generate(workshops) {
        const events = workshops.map(workshop => this.createEvent(workshop)).filter(Boolean);
        
        return this.wrapInCalendar(events.join('\n'));
    }

    /**
     * Create an iCalendar event (VEVENT) for a workshop
     * @param {Object} workshop - Workshop object
     * @returns {string} VEVENT formatted string
     */
    createEvent(workshop) {
        // Get all offerings for this workshop
        const offerings = this.data.offerings.filter(o => o.workshop_id === workshop.id);
        
        if (offerings.length === 0) return null;

        // For now, we'll create a separate event for each offering
        // (an alternative would be to use RRULE for recurring events)
        return offerings.map(offering => {
            const start = new Date(offering.start);
            const end = new Date(offering.end);
            
            // Build description with all workshop details
            const description = this.buildDescription(workshop, offering);
            const location = offering.location || 'TBA';
            const url = offering.registration_url || '';

            return `BEGIN:VEVENT
UID:${offering.id}@rds-workshops.ucsb.edu
DTSTAMP:${this.formatDate(new Date())}
DTSTART:${this.formatDate(start)}
DTEND:${this.formatDate(end)}
SUMMARY:${this.escapeText(workshop.title)}
DESCRIPTION:${this.escapeText(description)}
LOCATION:${this.escapeText(location)}${url ? '\nURL:' + url : ''}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${this.escapeText(workshop.title)} tomorrow
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${this.escapeText(workshop.title)} in 1 hour
END:VALARM
END:VEVENT`;
        }).join('\n');
    }

    /**
     * Build a detailed description for the event
     * @param {Object} workshop - Workshop object
     * @param {Object} offering - Offering object
     * @returns {string} Formatted description
     */
    buildDescription(workshop, offering) {
        let desc = workshop.description || workshop.summary || '';
        
        // Add metadata
        const format = this.data.formats.find(f => f.id === workshop.format_id);
        const instructors = workshop.instructor_ids.map(id => 
            this.data.instructors.find(i => i.id === id)?.name
        ).filter(Boolean).join(', ');
        const areas = workshop.area_ids.map(id => 
            this.data.areas.find(a => a.id === id)?.label
        ).filter(Boolean).join(', ');

        desc += '\n\n---\n';
        if (format) desc += `Format: ${format.label}\n`;
        if (instructors) desc += `Instructor(s): ${instructors}\n`;
        if (areas) desc += `Research Area(s): ${areas}\n`;
        if (offering.quarter) desc += `Quarter: ${offering.quarter} ${offering.year}\n`;
        if (offering.registration_url) desc += `\nRegister: ${offering.registration_url}`;
        
        return desc;
    }

    /**
     * Wrap events in calendar structure
     * @param {string} events - VEVENT strings
     * @returns {string} Complete ICS file content
     */
    wrapInCalendar(events) {
        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//UCSB Library//RDS Workshops//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:RDS Workshops
X-WR-TIMEZONE:America/Los_Angeles
X-WR-CALDESC:Research Data Services Workshop Catalogue
${events}
END:VCALENDAR`;
    }

    /**
     * Format date to iCalendar format (YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS)
     * @param {Date} date - JavaScript Date object
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        // Use local time (no Z suffix)
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    /**
     * Escape special characters in iCalendar text fields
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeText(text) {
        if (!text) return '';
        
        return text
            .replace(/\\/g, '\\\\')   // Backslash
            .replace(/;/g, '\\;')      // Semicolon
            .replace(/,/g, '\\,')      // Comma
            .replace(/\n/g, '\\n')     // Newline
            .replace(/\r/g, '');       // Remove carriage returns
    }

    /**
     * Download ICS file to user's computer
     * @param {string} content - ICS file content
     * @param {string} filename - Filename for download
     */
    static downloadICS(content, filename = 'rds-workshops.ics') {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Generate a webcal:// URL for calendar subscription
     * @param {string} baseUrl - Base URL of the hosted ICS file
     * @param {Object} filters - Current filter state
     * @returns {string} webcal:// URL
     */
    static generateWebcalURL(baseUrl, filters = {}) {
        const url = new URL(baseUrl);
        
        // Add filter parameters
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                url.searchParams.append(key, value);
            }
        });
        
        // Convert https:// to webcal://
        return url.toString().replace(/^https?:\/\//, 'webcal://');
    }
}
