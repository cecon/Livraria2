-- Feature 010 (ADR-0019): perfil de acesso do usuário na nuvem. Aditiva e idempotente.
-- `operador` (default, menor privilégio) | `admin`. O `perfil` sincroniza para o PDV.
-- O `adm` padrão do sistema é promovido a admin.
alter table usuario add column if not exists perfil text not null default 'operador';
update usuario set perfil = 'admin' where usuario = 'adm';
