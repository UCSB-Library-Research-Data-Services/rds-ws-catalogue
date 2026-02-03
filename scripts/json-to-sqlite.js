#!/usr/bin/env node

/**
 * Convert workshops.json to SQLite database for use with Datasette Lite
 * Run: node scripts/json-to-sqlite.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Paths
const dataPath = path.join(__dirname, '../assets/data/workshops.json');
const dbPath = path.join(__dirname, '../assets/data/workshops.db');

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  Removed existing database');
}

// Read JSON data
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
console.log('📖 Loaded workshops.json');

// Create database
const db = new Database(dbPath);
console.log('🗄️  Created new database');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    -- Lookup tables first (no dependencies)
    CREATE TABLE departments (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL
    );

    CREATE TABLE formats (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        icon TEXT
    );

    CREATE TABLE areas (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL
    );

    CREATE TABLE audiences (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL
    );

    -- Instructors (depends on departments)
    CREATE TABLE instructors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department_id TEXT,
        title TEXT,
        email TEXT,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );

    -- Series
    CREATE TABLE series (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT
    );

    -- Junction table for series-departments
    CREATE TABLE series_departments (
        series_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        PRIMARY KEY(series_id, department_id),
        FOREIGN KEY(series_id) REFERENCES series(id),
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );

    -- Series tags
    CREATE TABLE series_tags (
        series_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY(series_id, tag),
        FOREIGN KEY(series_id) REFERENCES series(id)
    );

    -- Workshops (depends on series, formats)
    CREATE TABLE workshops (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        description TEXT,
        series_id TEXT,
        format_id TEXT,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(series_id) REFERENCES series(id),
        FOREIGN KEY(format_id) REFERENCES formats(id)
    );

    -- Offerings (depends on workshops)
    CREATE TABLE offerings (
        id TEXT PRIMARY KEY,
        workshop_id TEXT NOT NULL,
        start TEXT NOT NULL,
        end TEXT NOT NULL,
        quarter TEXT,
        year INTEGER,
        location TEXT,
        registration_url TEXT,
        capacity INTEGER,
        FOREIGN KEY(workshop_id) REFERENCES workshops(id)
    );

    -- Junction tables for many-to-many relationships
    CREATE TABLE workshop_instructors (
        workshop_id TEXT NOT NULL,
        instructor_id TEXT NOT NULL,
        PRIMARY KEY(workshop_id, instructor_id),
        FOREIGN KEY(workshop_id) REFERENCES workshops(id),
        FOREIGN KEY(instructor_id) REFERENCES instructors(id)
    );

    CREATE TABLE workshop_areas (
        workshop_id TEXT NOT NULL,
        area_id TEXT NOT NULL,
        PRIMARY KEY(workshop_id, area_id),
        FOREIGN KEY(workshop_id) REFERENCES workshops(id),
        FOREIGN KEY(area_id) REFERENCES areas(id)
    );

    CREATE TABLE workshop_audiences (
        workshop_id TEXT NOT NULL,
        audience_id TEXT NOT NULL,
        PRIMARY KEY(workshop_id, audience_id),
        FOREIGN KEY(workshop_id) REFERENCES workshops(id),
        FOREIGN KEY(audience_id) REFERENCES audiences(id)
    );

    CREATE TABLE workshop_departments (
        workshop_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        PRIMARY KEY(workshop_id, department_id),
        FOREIGN KEY(workshop_id) REFERENCES workshops(id),
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );

    CREATE TABLE workshop_tags (
        workshop_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY(workshop_id, tag),
        FOREIGN KEY(workshop_id) REFERENCES workshops(id)
    );

    -- Create indexes for common queries
    CREATE INDEX idx_offerings_workshop ON offerings(workshop_id);
    CREATE INDEX idx_offerings_start ON offerings(start);
    CREATE INDEX idx_workshops_active ON workshops(is_active);
    CREATE INDEX idx_workshops_format ON workshops(format_id);
`);

console.log('📋 Created tables and indexes');

// Prepare insert statements
const insertDepartment = db.prepare('INSERT INTO departments (id, label) VALUES (?, ?)');
const insertFormat = db.prepare('INSERT INTO formats (id, label, icon) VALUES (?, ?, ?)');
const insertArea = db.prepare('INSERT INTO areas (id, label) VALUES (?, ?)');
const insertAudience = db.prepare('INSERT INTO audiences (id, label) VALUES (?, ?)');
const insertInstructor = db.prepare('INSERT INTO instructors (id, name, department_id, title, email) VALUES (?, ?, ?, ?, ?)');
const insertSeries = db.prepare('INSERT INTO series (id, title, description) VALUES (?, ?, ?)');
const insertSeriesDepartment = db.prepare('INSERT INTO series_departments (series_id, department_id) VALUES (?, ?)');
const insertSeriesTag = db.prepare('INSERT INTO series_tags (series_id, tag) VALUES (?, ?)');
const insertWorkshop = db.prepare('INSERT INTO workshops (id, title, summary, description, series_id, format_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insertOffering = db.prepare('INSERT INTO offerings (id, workshop_id, start, end, quarter, year, location, registration_url, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertWorkshopInstructor = db.prepare('INSERT INTO workshop_instructors (workshop_id, instructor_id) VALUES (?, ?)');
const insertWorkshopArea = db.prepare('INSERT INTO workshop_areas (workshop_id, area_id) VALUES (?, ?)');
const insertWorkshopAudience = db.prepare('INSERT INTO workshop_audiences (workshop_id, audience_id) VALUES (?, ?)');
const insertWorkshopDepartment = db.prepare('INSERT INTO workshop_departments (workshop_id, department_id) VALUES (?, ?)');
const insertWorkshopTag = db.prepare('INSERT INTO workshop_tags (workshop_id, tag) VALUES (?, ?)');

// Insert data in transaction for speed
const insertAll = db.transaction(() => {
    // 1. Departments
    data.departments.forEach(d => {
        insertDepartment.run(d.id, d.label);
    });
    console.log(`✓ Inserted ${data.departments.length} departments`);

    // 2. Formats
    data.formats.forEach(f => {
        insertFormat.run(f.id, f.label, f.icon || null);
    });
    console.log(`✓ Inserted ${data.formats.length} formats`);

    // 3. Areas
    data.areas.forEach(a => {
        insertArea.run(a.id, a.label);
    });
    console.log(`✓ Inserted ${data.areas.length} areas`);

    // 4. Audiences
    data.audiences.forEach(a => {
        insertAudience.run(a.id, a.label);
    });
    console.log(`✓ Inserted ${data.audiences.length} audiences`);

    // 5. Instructors
    data.instructors.forEach(i => {
        insertInstructor.run(i.id, i.name, i.department_id || null, i.title || null, i.email || null);
    });
    console.log(`✓ Inserted ${data.instructors.length} instructors`);

    // 6. Series
    if (data.series && data.series.length > 0) {
        data.series.forEach(s => {
            insertSeries.run(s.id, s.title, s.description || null);
            
            // Series departments
            if (s.department_ids) {
                s.department_ids.forEach(did => {
                    insertSeriesDepartment.run(s.id, did);
                });
            }
            
            // Series tags
            if (s.tags) {
                s.tags.forEach(tag => {
                    insertSeriesTag.run(s.id, tag);
                });
            }
        });
        console.log(`✓ Inserted ${data.series.length} series`);
    }

    // 7. Workshops
    data.workshops.forEach(w => {
        insertWorkshop.run(
            w.id,
            w.title,
            w.summary || null,
            w.description || null,
            w.series_id || null,
            w.format_id || null,
            w.is_active ? 1 : 0
        );

        // Workshop-Instructor relationships
        if (w.instructor_ids) {
            w.instructor_ids.forEach(iid => {
                insertWorkshopInstructor.run(w.id, iid);
            });
        }

        // Workshop-Area relationships
        if (w.area_ids) {
            w.area_ids.forEach(aid => {
                insertWorkshopArea.run(w.id, aid);
            });
        }

        // Workshop-Audience relationships
        if (w.audience_ids) {
            w.audience_ids.forEach(aid => {
                insertWorkshopAudience.run(w.id, aid);
            });
        }

        // Workshop-Department relationships
        if (w.department_ids) {
            w.department_ids.forEach(did => {
                insertWorkshopDepartment.run(w.id, did);
            });
        }

        // Workshop tags
        if (w.tags) {
            w.tags.forEach(tag => {
                insertWorkshopTag.run(w.id, tag);
            });
        }
    });
    console.log(`✓ Inserted ${data.workshops.length} workshops`);

    // 8. Offerings
    data.offerings.forEach(o => {
        insertOffering.run(
            o.id,
            o.workshop_id,
            o.start,
            o.end,
            o.quarter || null,
            o.year || null,
            o.location || null,
            o.registration_url || null,
            o.capacity || null
        );
    });
    console.log(`✓ Inserted ${data.offerings.length} offerings`);
});

// Execute transaction
insertAll();

// Create useful views for the app
db.exec(`
    -- View: Workshops with their format labels
    CREATE VIEW v_workshops_full AS
    SELECT 
        w.id,
        w.title,
        w.summary,
        w.description,
        w.series_id,
        w.format_id,
        f.label as format_label,
        f.icon as format_icon,
        w.is_active,
        s.title as series_title
    FROM workshops w
    LEFT JOIN formats f ON w.format_id = f.id
    LEFT JOIN series s ON w.series_id = s.id;

    -- View: Offerings with workshop info
    CREATE VIEW v_offerings_full AS
    SELECT 
        o.*,
        w.title as workshop_title,
        w.format_id,
        f.label as format_label
    FROM offerings o
    JOIN workshops w ON o.workshop_id = w.id
    LEFT JOIN formats f ON w.format_id = f.id;

    -- View: Workshop instructors with names
    CREATE VIEW v_workshop_instructors AS
    SELECT 
        wi.workshop_id,
        wi.instructor_id,
        i.name as instructor_name,
        i.title as instructor_title,
        i.email as instructor_email
    FROM workshop_instructors wi
    JOIN instructors i ON wi.instructor_id = i.id;

    -- View: Workshop areas with labels
    CREATE VIEW v_workshop_areas AS
    SELECT 
        wa.workshop_id,
        wa.area_id,
        a.label as area_label
    FROM workshop_areas wa
    JOIN areas a ON wa.area_id = a.id;

    -- View: Workshop audiences with labels
    CREATE VIEW v_workshop_audiences AS
    SELECT 
        wau.workshop_id,
        wau.audience_id,
        au.label as audience_label
    FROM workshop_audiences wau
    JOIN audiences au ON wau.audience_id = au.id;

    -- View: Workshop departments with labels
    CREATE VIEW v_workshop_departments AS
    SELECT 
        wd.workshop_id,
        wd.department_id,
        d.label as department_label
    FROM workshop_departments wd
    JOIN departments d ON wd.department_id = d.id;
`);

console.log('👁️  Created views');

// Close database
db.close();

// Get file size
const stats = fs.statSync(dbPath);
const fileSizeKB = (stats.size / 1024).toFixed(2);

console.log(`\n✨ Migration complete!`);
console.log(`📁 Database: ${dbPath}`);
console.log(`📊 Size: ${fileSizeKB} KB`);
console.log(`\n💡 Next: Update app.js to use Datasette Lite`);
