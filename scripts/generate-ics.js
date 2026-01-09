#!/usr/bin/env node

/**
 * Generate static ICS calendar files for common filter combinations
 * This script runs in GitHub Actions when workshops.json is updated
 */

const fs = require('fs');
const path = require('path');

// Read workshops data
const dataPath = path.join(__dirname, '../assets/data/workshops.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ICS Generator (Node.js version)
class ICalGenerator {
    constructor(data) {
        this.data = data;
    }

    generate(workshops) {
        const events = workshops.map(workshop => this.createEvent(workshop)).filter(Boolean);
        return this.wrapInCalendar(events.join('\n'));
    }

    createEvent(workshop) {
        const offerings = this.data.offerings.filter(o => o.workshop_id === workshop.id);
        if (offerings.length === 0) return null;

        return offerings.map(offering => {
            const start = new Date(offering.start);
            const end = new Date(offering.end);
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

    buildDescription(workshop, offering) {
        let desc = workshop.description || workshop.summary || '';
        
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

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    escapeText(text) {
        if (!text) return '';
        
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
    }
}

// Filter workshops
function filterWorkshops(filters = {}) {
    return data.workshops.filter(workshop => {
        if (!workshop.is_active) return false;

        if (filters.area && !workshop.area_ids.includes(filters.area)) return false;
        if (filters.audience && !workshop.audience_ids.includes(filters.audience)) return false;
        if (filters.format && workshop.format_id !== filters.format) return false;
        if (filters.department && !workshop.department_ids.includes(filters.department)) return false;
        if (filters.instructor && !workshop.instructor_ids.includes(filters.instructor)) return false;

        return true;
    });
}

// Generate calendar files
const generator = new ICalGenerator(data);
const calendarsDir = path.join(__dirname, '../calendars');

// Ensure calendars directory exists
if (!fs.existsSync(calendarsDir)) {
    fs.mkdirSync(calendarsDir, { recursive: true });
}

console.log('Generating calendar files...\n');

// 1. All workshops
const allWorkshops = filterWorkshops();
fs.writeFileSync(
    path.join(calendarsDir, 'all.ics'),
    generator.generate(allWorkshops)
);
console.log(`✓ Generated all.ics (${allWorkshops.length} workshops)`);

// 2. By research area
data.areas.forEach(area => {
    const workshops = filterWorkshops({ area: area.id });
    if (workshops.length > 0) {
        const filename = `area-${area.id}.ics`;
        fs.writeFileSync(
            path.join(calendarsDir, filename),
            generator.generate(workshops)
        );
        console.log(`✓ Generated ${filename} (${workshops.length} workshops)`);
    }
});

// 3. By audience
data.audiences.forEach(audience => {
    const workshops = filterWorkshops({ audience: audience.id });
    if (workshops.length > 0) {
        const filename = `audience-${audience.id}.ics`;
        fs.writeFileSync(
            path.join(calendarsDir, filename),
            generator.generate(workshops)
        );
        console.log(`✓ Generated ${filename} (${workshops.length} workshops)`);
    }
});

// 4. By format
data.formats.forEach(format => {
    const workshops = filterWorkshops({ format: format.id });
    if (workshops.length > 0) {
        const filename = `format-${format.id}.ics`;
        fs.writeFileSync(
            path.join(calendarsDir, filename),
            generator.generate(workshops)
        );
        console.log(`✓ Generated ${filename} (${workshops.length} workshops)`);
    }
});

// 5. By department
data.departments.forEach(department => {
    const workshops = filterWorkshops({ department: department.id });
    if (workshops.length > 0) {
        const filename = `department-${department.id}.ics`;
        fs.writeFileSync(
            path.join(calendarsDir, filename),
            generator.generate(workshops)
        );
        console.log(`✓ Generated ${filename} (${workshops.length} workshops)`);
    }
});

// 6. Popular combinations
const combinations = [
    { filters: { format: 'fmt-online', audience: 'aud-grad' }, name: 'online-grad' },
    { filters: { format: 'fmt-in-person', audience: 'aud-grad' }, name: 'in-person-grad' },
];

combinations.forEach(({ filters, name }) => {
    const workshops = filterWorkshops(filters);
    if (workshops.length > 0) {
        const filename = `${name}.ics`;
        fs.writeFileSync(
            path.join(calendarsDir, filename),
            generator.generate(workshops)
        );
        console.log(`✓ Generated ${filename} (${workshops.length} workshops)`);
    }
});

console.log('\n✨ Calendar generation complete!');
