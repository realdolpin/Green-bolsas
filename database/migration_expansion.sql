USE bolsas;

-- Extensão incremental: preserva as tabelas e os registos existentes.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS `role` ENUM('student','mentor') NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS birth_date DATE NULL,
  ADD COLUMN IF NOT EXISTS institution VARCHAR(180) NULL,
  ADD COLUMN IF NOT EXISTS education VARCHAR(180) NULL,
  ADD COLUMN IF NOT EXISTS academic_level VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS premium_started_at DATE NULL,
  ADD COLUMN IF NOT EXISTS subscription_status ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'expired';

ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS field_of_study VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS language VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS status ENUM('draft','published','suspended') NOT NULL DEFAULT 'published';

ALTER TABLE applications
  MODIFY COLUMN status ENUM('submetida','em_analise','aceite','recusada','retirada') NOT NULL DEFAULT 'submetida';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method ENUM('multicaixa_demo','transfer_demo','reference_demo') NOT NULL DEFAULT 'reference_demo';

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

-- Reflecte os administradores já existentes e planos Premium ainda válidos.
UPDATE users SET subscription_status = CASE
  WHEN plan='premium' AND premium_until >= CURDATE() THEN 'active'
  WHEN plan='premium' THEN 'expired'
  ELSE 'expired' END,
  premium_started_at = COALESCE(premium_started_at, CASE WHEN plan='premium' THEN DATE_SUB(premium_until, INTERVAL 30 DAY) END);

