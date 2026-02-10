-- Mise à jour des icônes pour les badges existants
UPDATE public.badges SET icon = 'fa-compass' WHERE name = 'Explorateur';
UPDATE public.badges SET icon = 'fa-map-location-dot' WHERE name = 'Baroudeur';
UPDATE public.badges SET icon = 'fa-medal' WHERE name = 'Vétéran';
UPDATE public.badges SET icon = 'fa-crown' WHERE name = 'Légende';

UPDATE public.badges SET icon = 'fa-laptop-code' WHERE name = 'Néophyte Digital';
UPDATE public.badges SET icon = 'fa-keyboard' WHERE name = 'Virtuose du Clavier';
UPDATE public.badges SET icon = 'fa-bugs' WHERE name = 'Oracle du Code';

UPDATE public.badges SET icon = 'fa-screwdriver-wrench' WHERE name = 'Monteur Amateur';
UPDATE public.badges SET icon = 'fa-microchip' WHERE name = 'Chirurgien de la Tour';
UPDATE public.badges SET icon = 'fa-robot' WHERE name = 'Deus Ex Machina';

UPDATE public.badges SET icon = 'fa-network-wired' WHERE name = 'Câbleur';
UPDATE public.badges SET icon = 'fa-shield-halved' WHERE name = 'Garde-Réseau';
UPDATE public.badges SET icon = 'fa-cloud' WHERE name = 'Architecte Cloud';
