/**
 * Database wrapper for sql.js (SQLite compiled to WebAssembly)
 * Provides a simple interface for querying the workshops database
 */

class WorkshopDB {
    constructor() {
        this.db = null;
        this.ready = false;
    }

    /**
     * Initialize the database by loading sql.js and the database file
     */
    async init() {
        try {
            // Load sql.js from CDN
            const SQL = await initSqlJs({
                locateFile: file => `https://sql.js.org/dist/${file}`
            });

            // Fetch the database file
            const response = await fetch('assets/data/workshops.db');
            if (!response.ok) {
                throw new Error(`Failed to fetch database: ${response.status}`);
            }
            
            const buffer = await response.arrayBuffer();
            this.db = new SQL.Database(new Uint8Array(buffer));
            this.ready = true;
            
            console.log('📊 Database loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Execute a SQL query and return results as an array of objects
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Array} Array of result objects
     */
    query(sql, params = []) {
        if (!this.ready) {
            throw new Error('Database not initialized');
        }

        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            
            const results = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row);
            }
            stmt.free();
            
            return results;
        } catch (error) {
            console.error('Query error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    /**
     * Execute a query and return the first result
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Object|null} First result or null
     */
    queryOne(sql, params = []) {
        const results = this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    // ==================== Lookup Tables ====================

    /**
     * Get all departments
     */
    getDepartments() {
        return this.query('SELECT * FROM departments ORDER BY label');
    }

    /**
     * Get all formats
     */
    getFormats() {
        return this.query('SELECT * FROM formats ORDER BY label');
    }

    /**
     * Get all areas
     */
    getAreas() {
        return this.query('SELECT * FROM areas ORDER BY label');
    }

    /**
     * Get all audiences
     */
    getAudiences() {
        return this.query('SELECT * FROM audiences ORDER BY label');
    }

    /**
     * Get all instructors
     */
    getInstructors() {
        return this.query('SELECT * FROM instructors ORDER BY name');
    }

    /**
     * Get all series
     */
    getSeries() {
        return this.query('SELECT * FROM series ORDER BY title');
    }

    // ==================== Workshop Queries ====================

    /**
     * Get all workshops with their format info
     */
    getAllWorkshops() {
        return this.query(`
            SELECT 
                w.*,
                f.label as format_label,
                f.icon as format_icon,
                s.title as series_title
            FROM workshops w
            LEFT JOIN formats f ON w.format_id = f.id
            LEFT JOIN series s ON w.series_id = s.id
            WHERE w.is_active = 1
            ORDER BY w.title
        `);
    }

    /**
     * Get workshops filtered by various criteria
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered workshops
     */
    getFilteredWorkshops(filters = {}) {
        let sql = `
            SELECT DISTINCT
                w.id,
                w.title,
                w.summary,
                w.description,
                w.series_id,
                w.format_id,
                w.is_active,
                f.label as format_label,
                f.icon as format_icon,
                s.title as series_title
            FROM workshops w
            LEFT JOIN formats f ON w.format_id = f.id
            LEFT JOIN series s ON w.series_id = s.id
        `;
        
        const joins = [];
        const conditions = ['w.is_active = 1'];
        const params = [];

        // Area filter
        if (filters.area) {
            joins.push('JOIN workshop_areas wa ON w.id = wa.workshop_id');
            conditions.push('wa.area_id = ?');
            params.push(filters.area);
        }

        // Audience filter
        if (filters.audience) {
            joins.push('JOIN workshop_audiences wau ON w.id = wau.workshop_id');
            conditions.push('wau.audience_id = ?');
            params.push(filters.audience);
        }

        // Department filter
        if (filters.department) {
            joins.push('JOIN workshop_departments wd ON w.id = wd.workshop_id');
            conditions.push('wd.department_id = ?');
            params.push(filters.department);
        }

        // Instructor filter
        if (filters.instructor) {
            joins.push('JOIN workshop_instructors wi ON w.id = wi.workshop_id');
            conditions.push('wi.instructor_id = ?');
            params.push(filters.instructor);
        }

        // Format filter
        if (filters.format) {
            conditions.push('w.format_id = ?');
            params.push(filters.format);
        }

        // Search filter (searches title, summary, description, and tags)
        if (filters.search) {
            const searchTerm = `%${filters.search}%`;
            conditions.push(`(
                w.title LIKE ? OR 
                w.summary LIKE ? OR 
                w.description LIKE ? OR
                w.id IN (SELECT workshop_id FROM workshop_tags WHERE tag LIKE ?)
            )`);
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Build final query
        sql += joins.join(' ') + ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY w.title';

        return this.query(sql, params);
    }

    /**
     * Get instructors for a workshop
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopInstructors(workshopId) {
        return this.query(`
            SELECT i.*
            FROM instructors i
            JOIN workshop_instructors wi ON i.id = wi.instructor_id
            WHERE wi.workshop_id = ?
            ORDER BY i.name
        `, [workshopId]);
    }

    /**
     * Get areas for a workshop
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopAreas(workshopId) {
        return this.query(`
            SELECT a.*
            FROM areas a
            JOIN workshop_areas wa ON a.id = wa.area_id
            WHERE wa.workshop_id = ?
            ORDER BY a.label
        `, [workshopId]);
    }

    /**
     * Get audiences for a workshop
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopAudiences(workshopId) {
        return this.query(`
            SELECT au.*
            FROM audiences au
            JOIN workshop_audiences wau ON au.id = wau.audience_id
            WHERE wau.workshop_id = ?
            ORDER BY au.label
        `, [workshopId]);
    }

    /**
     * Get departments for a workshop
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopDepartments(workshopId) {
        return this.query(`
            SELECT d.*
            FROM departments d
            JOIN workshop_departments wd ON d.id = wd.department_id
            WHERE wd.workshop_id = ?
            ORDER BY d.label
        `, [workshopId]);
    }

    /**
     * Get tags for a workshop
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopTags(workshopId) {
        return this.query(`
            SELECT tag
            FROM workshop_tags
            WHERE workshop_id = ?
            ORDER BY tag
        `, [workshopId]);
    }

    // ==================== Offering Queries ====================

    /**
     * Get all offerings for a workshop
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopOfferings(workshopId) {
        return this.query(`
            SELECT *
            FROM offerings
            WHERE workshop_id = ?
            ORDER BY start
        `, [workshopId]);
    }

    /**
     * Get upcoming offerings for a workshop
     * @param {string} workshopId - Workshop ID
     * @param {string} now - ISO date string for current time
     */
    getUpcomingOfferings(workshopId, now) {
        return this.query(`
            SELECT *
            FROM offerings
            WHERE workshop_id = ? AND start > ?
            ORDER BY start
        `, [workshopId, now]);
    }

    /**
     * Get past offerings for a workshop
     * @param {string} workshopId - Workshop ID
     * @param {string} now - ISO date string for current time
     */
    getPastOfferings(workshopId, now) {
        return this.query(`
            SELECT *
            FROM offerings
            WHERE workshop_id = ? AND start <= ?
            ORDER BY start DESC
        `, [workshopId, now]);
    }

    /**
     * Get the first upcoming offering for each workshop
     * @param {string} now - ISO date string for current time
     */
    getFirstUpcomingOfferings(now) {
        return this.query(`
            SELECT o.*
            FROM offerings o
            INNER JOIN (
                SELECT workshop_id, MIN(start) as first_start
                FROM offerings
                WHERE start > ?
                GROUP BY workshop_id
            ) first ON o.workshop_id = first.workshop_id AND o.start = first.first_start
            ORDER BY o.start
        `, [now]);
    }

    /**
     * Check if workshop has upcoming offerings
     * @param {string} workshopId - Workshop ID
     * @param {string} now - ISO date string
     */
    hasUpcomingOfferings(workshopId, now) {
        const result = this.queryOne(`
            SELECT COUNT(*) as count
            FROM offerings
            WHERE workshop_id = ? AND start > ?
        `, [workshopId, now]);
        return result && result.count > 0;
    }

    /**
     * Check if workshop has past offerings
     * @param {string} workshopId - Workshop ID
     * @param {string} now - ISO date string
     */
    hasPastOfferings(workshopId, now) {
        const result = this.queryOne(`
            SELECT COUNT(*) as count
            FROM offerings
            WHERE workshop_id = ? AND start <= ?
        `, [workshopId, now]);
        return result && result.count > 0;
    }

    /**
     * Get workshops with upcoming/past offerings based on timeframe
     * @param {string} timeframe - 'upcoming' or 'past'
     * @param {string} now - ISO date string
     */
    getWorkshopsByTimeframe(timeframe, now) {
        const operator = timeframe === 'upcoming' ? '>' : '<=';
        return this.query(`
            SELECT DISTINCT w.id
            FROM workshops w
            JOIN offerings o ON w.id = o.workshop_id
            WHERE w.is_active = 1 AND o.start ${operator} ?
        `, [now]);
    }

    // ==================== Full Workshop Data ====================

    /**
     * Get a workshop with all its related data
     * @param {string} workshopId - Workshop ID
     */
    getWorkshopFull(workshopId) {
        const workshop = this.queryOne(`
            SELECT 
                w.*,
                f.label as format_label,
                f.icon as format_icon,
                s.title as series_title
            FROM workshops w
            LEFT JOIN formats f ON w.format_id = f.id
            LEFT JOIN series s ON w.series_id = s.id
            WHERE w.id = ?
        `, [workshopId]);

        if (!workshop) return null;

        return {
            ...workshop,
            instructors: this.getWorkshopInstructors(workshopId),
            areas: this.getWorkshopAreas(workshopId),
            audiences: this.getWorkshopAudiences(workshopId),
            departments: this.getWorkshopDepartments(workshopId),
            tags: this.getWorkshopTags(workshopId).map(t => t.tag),
            offerings: this.getWorkshopOfferings(workshopId)
        };
    }

    /**
     * Get all workshops with their complete data for display
     * @param {Object} filters - Optional filters
     * @param {string} now - ISO date string for timeframe filtering
     */
    getWorkshopsWithDetails(filters = {}, now) {
        // First get the filtered workshop IDs
        let workshops = this.getFilteredWorkshops(filters);
        
        // Filter by timeframe if specified
        if (filters.timeframe && now) {
            const workshopIdsWithOfferings = this.getWorkshopsByTimeframe(filters.timeframe, now)
                .map(w => w.id);
            workshops = workshops.filter(w => workshopIdsWithOfferings.includes(w.id));
        }

        // Enrich each workshop with related data
        return workshops.map(workshop => ({
            ...workshop,
            instructors: this.getWorkshopInstructors(workshop.id),
            areas: this.getWorkshopAreas(workshop.id),
            audiences: this.getWorkshopAudiences(workshop.id),
            departments: this.getWorkshopDepartments(workshop.id),
            tags: this.getWorkshopTags(workshop.id).map(t => t.tag),
            offerings: this.getWorkshopOfferings(workshop.id)
        }));
    }
}

// Export for use in app.js
window.WorkshopDB = WorkshopDB;
