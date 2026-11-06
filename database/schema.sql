CREATE DATABASE IF NOT EXISTS bolsas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bolsas;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  plan ENUM('basico','premium') NOT NULL DEFAULT 'basico',
  premium_until DATE NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scholarships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  institution VARCHAR(200) NOT NULL,
  country ENUM('Brasil','Estados Unidos','Portugal','Itália','Roménia') NOT NULL,
  scope ENUM('interna','externa') NOT NULL DEFAULT 'externa',
  level ENUM('Licenciatura','Mestrado','Doutoramento','Curso técnico') NOT NULL,
  coverage_percent TINYINT UNSIGNED NOT NULL,        -- comparticipação (0-100)
  deadline DATE NOT NULL,
  description TEXT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (country), INDEX (scope), INDEX (deadline)
);

CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scholarship_id INT NOT NULL,
  motivation TEXT NOT NULL,
  status ENUM('submetida','em_analise','aceite','recusada') DEFAULT 'submetida',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app (user_id, scholarship_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE CASCADE
);

CREATE TABLE mentorship_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scholarship_id INT NULL,
  message TEXT NOT NULL,
  status ENUM('pendente','agendada','concluida') DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE SET NULL
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference VARCHAR(80) NOT NULL,
  status ENUM('pendente','pago') DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO scholarships (title,institution,country,scope,level,coverage_percent,deadline,description) VALUES
('Bolsa de Mérito Lusófono','Universidade de Coimbra','Portugal','externa','Licenciatura',50,'2027-03-15','Comparticipação de 50% das propinas para estudantes de países de língua portuguesa.'),
('Mestrado em Engenharia Aberta','Universidade do Porto','Portugal','externa','Mestrado',70,'2027-02-28','Propinas comparticipadas a 70% e apoio ao alojamento.'),
('PEC-G Complementar','Universidade de São Paulo','Brasil','externa','Licenciatura',60,'2027-04-10','Apoio de 60% nas despesas académicas para estudantes africanos.'),
('Pós-graduação em Saúde Pública','UFRJ','Brasil','externa','Mestrado',80,'2027-05-02','Bolsa parcial com isenção de taxas e apoio à investigação.'),
('Global Scholars Partial Award','Arizona State University','Estados Unidos','externa','Licenciatura',40,'2027-01-31','Redução de 40% nas propinas anuais, renovável por 4 anos.'),
('STEM Graduate Fellowship','Purdue University','Estados Unidos','externa','Doutoramento',75,'2027-02-15','Comparticipação de 75% com possibilidade de assistência de investigação.'),
('DSU Regione Lazio','Università La Sapienza','Itália','externa','Mestrado',65,'2027-06-30','Comparticipação em propinas e refeições universitárias.'),
('Borsa Internazionale Bologna','Università di Bologna','Itália','externa','Licenciatura',55,'2027-03-01','Redução de propinas por mérito e rendimento familiar.'),
('Bursa Guvernului Român','Universitatea Politehnică București','Roménia','externa','Licenciatura',60,'2027-07-15','Estudo em inglês com 60% de propinas cobertas e alojamento subsidiado.'),
('Medicina em Cluj-Napoca','UMF Iuliu Hațieganu','Roménia','externa','Mestrado',45,'2027-06-01','Comparticipação de 45% para programas de saúde em inglês.');
-- Para criar um administrador: UPDATE users SET is_admin=1 WHERE email='o.teu@email.com';

-- este é um teste de actualização