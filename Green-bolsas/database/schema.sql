-- =====================================================================
-- Green Bolsas — base de dados COMPLETA (instalação do zero, ficheiro único)
-- Importa este file no phpMyAdmin (separador Importar) e mais nada.
-- =====================================================================
CREATE DATABASE IF NOT EXISTS bolsas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bolsas;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  plan ENUM('basico','premium') NOT NULL DEFAULT 'basico',
  premium_until DATE NULL,
  premium_started_at DATE NULL,
  subscription_status ENUM('pending','active','expired','cancelled','suspended') NOT NULL DEFAULT 'expired',
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  `role` ENUM('student','mentor') NOT NULL DEFAULT 'student',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  phone VARCHAR(40) NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(100) NULL,
  birth_date DATE NULL,
  institution VARCHAR(180) NULL,
  education VARCHAR(180) NULL,
  academic_level VARCHAR(80) NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE scholarships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  institution VARCHAR(200) NOT NULL,
  country VARCHAR(100) NOT NULL,
  scope ENUM('interna','externa') NOT NULL DEFAULT 'externa',
  level VARCHAR(60) NOT NULL,
  field_of_study VARCHAR(160) NULL,
  language VARCHAR(100) NULL,
  coverage_percent TINYINT UNSIGNED NOT NULL,
  deadline DATE NOT NULL,
  description TEXT NOT NULL,
  status ENUM('draft','published','suspended') NOT NULL DEFAULT 'published',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (country), INDEX (scope), INDEX (deadline)
) ENGINE=InnoDB;

CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scholarship_id INT NOT NULL,
  motivation TEXT NOT NULL,
  status ENUM('submetida','em_analise','aceite','recusada','retirada','suspended') NOT NULL DEFAULT 'submetida',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app (user_id, scholarship_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mentorship_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scholarship_id INT NULL,
  message TEXT NOT NULL,
  status ENUM('pendente','agendada','concluida') DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference VARCHAR(80) NOT NULL,
  status ENUM('pendente','pago') DEFAULT 'pendente',
  payment_method ENUM('multicaixa_demo','transfer_demo','reference_demo') NOT NULL DEFAULT 'reference_demo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mentor_profiles (
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
) ENGINE=InnoDB;

CREATE TABLE mentor_connections (
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
) ENGINE=InnoDB;

CREATE TABLE mentor_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  connection_id INT NOT NULL,
  sender_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  INDEX idx_message_connection (connection_id,id),
  CONSTRAINT fk_message_connection FOREIGN KEY (connection_id) REFERENCES mentor_connections(id) ON DELETE RESTRICT,
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE notifications (
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
) ENGINE=InnoDB;

CREATE TABLE saved_scholarships (
  user_id INT NOT NULL,
  scholarship_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,scholarship_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_scholarship FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE application_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  changed_by INT NULL,
  old_status VARCHAR(30) NULL,
  new_status VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_application_history (application_id,created_at),
  CONSTRAINT fk_history_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bolsas por defeito (instituições, níveis, áreas e idiomas iguais às listas do formulário)
-- Comparticipação e prazos das bolsas de Angola são provisórios: edita no painel admin.
-- ---------------------------------------------------------------------
INSERT INTO scholarships (title,institution,country,scope,level,field_of_study,language,coverage_percent,deadline,description) VALUES
('Bolsa de Mérito Sonangol','ISPTEC','Angola','interna','Licenciatura','Engenharia','Português',70,'2027-03-31','Bolsa de mérito da Sonangol para estudantes do ISPTEC.'),
('Bolsa de Mérito TotalEnergies','ISPTEC','Angola','interna','Licenciatura','Engenharia','Português',60,'2027-03-31','Bolsa de mérito da TotalEnergies para estudantes do ISPTEC.'),
('Bolsa de Mérito TotalEnergies','Universidade Agostinho Neto','Angola','interna','Licenciatura','Engenharia','Português',60,'2027-03-31','Bolsa de mérito da TotalEnergies para estudantes da Universidade Agostinho Neto.'),
('Bolsa de Mérito TotalEnergies','Universidade Católica de Angola','Angola','interna','Licenciatura','Engenharia','Português',60,'2027-03-31','Bolsa de mérito da TotalEnergies para estudantes da Universidade Católica de Angola.'),
('Bolsa de Mérito Lusófono','Universidade de Coimbra','Portugal','externa','Licenciatura','Ciências Sociais','Português',50,'2027-03-15','Comparticipação de 50% das propinas para estudantes de países de língua portuguesa.'),
('Mestrado em Engenharia Aberta','Universidade do Porto','Portugal','externa','Mestrado','Engenharia','Inglês',70,'2027-02-28','Propinas comparticipadas a 70% e apoio ao alojamento.'),
('PEC-G Complementar','Universidade de São Paulo','Brasil','externa','Licenciatura','Engenharia Informática','Português',60,'2027-04-10','Apoio de 60% nas despesas académicas para estudantes africanos.'),
('Pós-graduação em Saúde Pública','UFRJ','Brasil','externa','Mestrado','Saúde Pública','Português',80,'2027-05-02','Bolsa parcial com isenção de taxas e apoio à investigação.'),
('Global Scholars Partial Award','Arizona State University','Estados Unidos','externa','Licenciatura','Engenharia Informática','Inglês',40,'2027-01-31','Redução de 40% nas propinas anuais, renovável por 4 anos.'),
('STEM Graduate Fellowship','Purdue University','Estados Unidos','externa','Doutoramento','Engenharia','Inglês',75,'2027-02-15','Comparticipação de 75% com possibilidade de assistência de investigação.'),
('DSU Regione Lazio','Università La Sapienza','Itália','externa','Mestrado','Economia','Italiano',65,'2027-06-30','Comparticipação em propinas e refeições universitárias.'),
('Borsa Internazionale Bologna','Università di Bologna','Itália','externa','Licenciatura','Gestão','Italiano',55,'2027-03-01','Redução de propinas por mérito e rendimento familiar.'),
('Bursa Guvernului Român','Universitatea Politehnică București','Roménia','externa','Licenciatura','Engenharia','Inglês',60,'2027-07-15','Estudo em inglês com 60% de propinas cobertas e alojamento subsidiado.'),
('Medicina em Cluj-Napoca','UMF Iuliu Hațieganu','Roménia','externa','Mestrado','Medicina','Inglês',45,'2027-06-01','Comparticipação de 45% para programas de saúde em inglês.');

-- Depois de criares a tua conta no site, torna-a administradora (troca o email):
-- UPDATE users SET is_admin=1 WHERE email='o.teu@email.com';
