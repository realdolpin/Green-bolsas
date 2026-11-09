USE bolsas;
-- 1) Permite registar qualquer país, nível ou curso (antes eram listas fixas ENUM)
ALTER TABLE scholarships MODIFY COLUMN country VARCHAR(100) NOT NULL;
ALTER TABLE scholarships MODIFY COLUMN level VARCHAR(60) NOT NULL;

-- 2) Bolsas internas (Angola) por defeito. Valores de comparticipação e prazo são provisórios: edita no painel admin.
INSERT INTO scholarships (title,institution,country,scope,level,coverage_percent,deadline,description,language,status,active)
SELECT * FROM (
 SELECT 'Bolsa de Mérito Sonangol' t,'ISPTEC' i,'Angola' c,'interna' s,'Licenciatura' l,70 p,'2027-03-31' d,'Bolsa de mérito da Sonangol para estudantes do ISPTEC.' de,'Português' lg,'published' st,1 a
 UNION ALL SELECT 'Bolsa de Mérito TotalEnergies','ISPTEC','Angola','interna','Licenciatura',60,'2027-03-31','Bolsa de mérito da TotalEnergies para estudantes do ISPTEC.','Português','published',1
 UNION ALL SELECT 'Bolsa de Mérito TotalEnergies','Universidade Agostinho Neto','Angola','interna','Licenciatura',60,'2027-03-31','Bolsa de mérito da TotalEnergies para estudantes da Universidade Agostinho Neto.','Português','published',1
 UNION ALL SELECT 'Bolsa de Mérito TotalEnergies','Universidade Católica de Angola','Angola','interna','Licenciatura',60,'2027-03-31','Bolsa de mérito da TotalEnergies para estudantes da Universidade Católica de Angola.','Português','published',1
) x WHERE NOT EXISTS (SELECT 1 FROM scholarships s WHERE s.title=x.t AND s.institution=x.i);
