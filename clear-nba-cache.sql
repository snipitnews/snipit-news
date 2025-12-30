-- Clear cached summary for NBA topic
DELETE FROM summary_cache 
WHERE topic = 'NBA' 
  AND date = CURRENT_DATE;
