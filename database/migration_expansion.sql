
USE bolsas;

SET @db = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role') = 0,
    'ALTER TABLE users ADD COLUMN `role` ENUM(''student'',''mentor'') NOT NULL DEFAULT ''student''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active') = 0,
    'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone') = 0,
    'ALTER TABLE users ADD COLUMN phone VARCHAR(40) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'country') = 0,
    'ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'city') = 0,
    'ALTER TABLE users ADD COLUMN city VARCHAR(100) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_date') = 0,
    'ALTER TABLE users ADD COLUMN birth_date DATE NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'institution') = 0,
    'ALTER TABLE users ADD COLUMN institution VARCHAR(180) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'education') = 0,
    'ALTER TABLE users ADD COLUMN education VARCHAR(180) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'academic_level') = 0,
    'ALTER TABLE users ADD COLUMN academic_level VARCHAR(80) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'premium_started_at') = 0,
    'ALTER TABLE users ADD COLUMN premium_started_at DATE NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deleted_at') = 0,
    'ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_status') = 0,
    'ALTER TABLE users ADD COLUMN subscription_status ENUM(''pending'',''active'',''expired'',''cancelled'') NOT NULL DEFAULT ''expired''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'scholarships' AND COLUMN_NAME = 'field_of_study') = 0,
    'ALTER TABLE scholarships ADD COLUMN field_of_study VARCHAR(160) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'scholarships' AND COLUMN_NAME = 'language') = 0,
    'ALTER TABLE scholarships ADD COLUMN language VARCHAR(100) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'scholarships' AND COLUMN_NAME = 'status') = 0,
    'ALTER TABLE scholarships ADD COLUMN status ENUM(''draft'',''published'',''suspended'') NOT NULL DEFAULT ''published''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_method') = 0,
    'ALTER TABLE payments ADD COLUMN payment_method ENUM(''multicaixa_demo'',''transfer_demo'',''reference_demo'') NOT NULL DEFAULT ''reference_demo''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE applications
MODIFY COLUMN status ENUM('submetida','em_analise','aceite','recusada','retirada','suspended') NOT NULL DEFAULT 'submetida';

ALTER TABLE users
MODIFY COLUMN subscription_status ENUM('pending','active','expired','cancelled','suspended') NOT NULL DEFAULT 'expired';

CREATE TABLE IF NOT EXISTS mentor_profiles (
    user_id INT PRIMARY KEY,
    biography TEXT NULL,
    education TEXT NULL,
    experience TEXT NULL,
    countries TEXT NULL,
    fields TEXT NULL,
    levels TEXT NULL,
    languages TEXT NULL,
    specialties TEXT NULL,
    availability VARCHAR(180) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mentor_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mentor_connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    mentor_id INT NOT NULL,
    scholarship_id INT NULL,
    initial_message TEXT NULL,
    status ENUM('pending','accepted','rejected','cancelled','ended') NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    ended_at DATETIME NULL,
    INDEX idx_connection_student_status (student_id,status),
    INDEX idx_connection_mentor_status (mentor_id,status),
    CONSTRAINT fk_connection_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_connection_mentor FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_connection_scholarship FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mentor_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connection_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    INDEX idx_message_connection (connection_id,id),
    CONSTRAINT fk_message_connection FOREIGN KEY (connection_id) REFERENCES mentor_connections(id) ON DELETE RESTRICT,
    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    event_key VARCHAR(190) NOT NULL,
    content VARCHAR(500) NOT NULL,
    link VARCHAR(255) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notification_event (user_id,event_key),
    INDEX idx_notification_inbox (user_id,is_read,created_at),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_scholarships (
    user_id INT NOT NULL,
    scholarship_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id,scholarship_id),
    CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_scholarship FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS application_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    changed_by INT NULL,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_application_history (application_id,created_at),
    CONSTRAINT fk_history_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

UPDATE users
SET
    subscription_status = CASE
        WHEN plan = 'premium' AND premium_until >= CURDATE() THEN 'active'
        WHEN plan = 'premium' THEN 'expired'
        ELSE 'expired'
    END,
    premium_started_at = COALESCE(
        premium_started_at,
        CASE
            WHEN plan = 'premium' THEN DATE_SUB(premium_until, INTERVAL 30 DAY)
            ELSE NULL
        END
    );