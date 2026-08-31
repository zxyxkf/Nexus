async function columnExists(execute, mode, table, column) {
  if (mode === 'mysql') {
    const [rows] = await execute(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
      [table, column]
    );
    return rows.length > 0;
  }
  const [rows] = await execute(`PRAGMA table_info(${table})`);
  return rows.some(row => row.name === column);
}

async function ensureColumn(execute, mode, table, column, definition) {
  if (await columnExists(execute, mode, table, column)) return;
  await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureColumns(execute, mode) {
  const text = mode === 'mysql' ? 'VARCHAR(200)' : 'TEXT';
  const date = mode === 'mysql' ? 'DATETIME' : 'TEXT';
  const tinyInt = mode === 'mysql' ? 'TINYINT' : 'INTEGER';
  const int = mode === 'mysql' ? 'INT' : 'INTEGER';

  await ensureColumn(execute, mode, 'payment_selection_image', 'adjustment_id', `${int} DEFAULT NULL`);
  await ensureColumn(execute, mode, 'payment_selection_testing', 'paid_enabled', `${tinyInt} DEFAULT NULL`);
  await ensureColumn(execute, mode, 'payment_selection_testing', 'paid_at', `${date} DEFAULT NULL`);
  await ensureColumn(execute, mode, 'payment_selection_testing', 'promotion_method', `${text} DEFAULT ''`);
  await ensureColumn(execute, mode, 'payment_selection_monitoring', 'link_optimized', `${tinyInt} DEFAULT NULL`);
  await ensureColumn(execute, mode, 'payment_selection_monitoring', 'link_status', `${mode === 'mysql' ? 'VARCHAR(30)' : 'TEXT'} DEFAULT ''`);
  await ensureColumn(execute, mode, 'payment_selection_adjustment', 'client_key', `${mode === 'mysql' ? 'VARCHAR(100)' : 'TEXT'} DEFAULT NULL`);

  if (mode === 'mysql') {
    try {
      await execute('CREATE INDEX idx_payment_image_adjustment ON payment_selection_image(record_id, category, adjustment_id, deleted_at, sort_order)');
    } catch (error) {
      if (!String(error.message || '').toLowerCase().includes('duplicate')) throw error;
    }
  } else {
    await execute(`CREATE INDEX IF NOT EXISTS idx_payment_image_adjustment
      ON payment_selection_image(record_id, category, adjustment_id, deleted_at, sort_order)`);
  }
}

async function ensureTestingRows(execute, mode) {
  const insert = mode === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  await execute(
    `${insert} INTO payment_selection_testing (record_id)
     SELECT record_id FROM payment_selection_preparation`
  );
  await execute(
    `${insert} INTO payment_selection_testing (record_id)
     SELECT id FROM payment_selection_record WHERE current_stage = 'preparation' OR end_stage = 'preparation'`
  );
}

async function migratePreparationData(execute) {
  await execute(
    `UPDATE payment_selection_testing
     SET paid_enabled = COALESCE(paid_enabled, (
           SELECT paid_enabled FROM payment_selection_preparation p
           WHERE p.record_id = payment_selection_testing.record_id
         )),
         paid_at = COALESCE(paid_at, (
           SELECT paid_at FROM payment_selection_preparation p
           WHERE p.record_id = payment_selection_testing.record_id
         ))
     WHERE EXISTS (
       SELECT 1 FROM payment_selection_preparation p
       WHERE p.record_id = payment_selection_testing.record_id
     )`
  );
}

async function migrateStageRows(execute, mode) {
  const insert = mode === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  await execute(
    `${insert} INTO payment_selection_stage
       (record_id, stage_code, stage_status, is_reopened, entered_at, completed_at)
     SELECT record_id, 'testing', stage_status, is_reopened, entered_at, completed_at
     FROM payment_selection_stage WHERE stage_code = 'preparation'`
  );
  await execute(
    `UPDATE payment_selection_stage
     SET stage_status = 'ended'
     WHERE stage_code = 'testing'
       AND record_id IN (
         SELECT record_id FROM payment_selection_stage
         WHERE stage_code = 'preparation' AND stage_status = 'ended'
       )`
  );
  await execute("UPDATE payment_selection_record SET current_stage = 'testing' WHERE current_stage = 'preparation'");
  await execute("UPDATE payment_selection_record SET end_stage = 'testing' WHERE end_stage = 'preparation'");
  await execute("DELETE FROM payment_selection_stage WHERE stage_code = 'preparation'");
}

async function backfillSelectionDates(execute) {
  await execute(
    `UPDATE payment_selection_record
     SET selection_date = (
       SELECT create_time FROM task_info WHERE task_info.id = payment_selection_record.source_task_id
     )
     WHERE source_task_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM task_info WHERE task_info.id = payment_selection_record.source_task_id)`
  );
}

async function migrateMonitoringStatus(execute) {
  await execute(
    `UPDATE payment_selection_monitoring
     SET link_status = CASE WHEN abandoned = 1 THEN 'protect_roi' ELSE 'keep_breaking' END
     WHERE link_status IS NULL OR link_status = ''`
  );
}

async function clearRetiredValues(execute, mode) {
  await execute('UPDATE payment_selection_record SET design_main_image = 0, sku_le_200 = NULL');
  await execute(
    `UPDATE payment_selection_testing SET
       promotion_method = '', car_promotion_method = '', car_clicks = NULL,
       car_ctr = NULL, car_qualifies = NULL, site_promotion_method = '',
       overall_visitors = NULL, search_visitors = NULL, buyers = NULL,
       average_ctr = NULL`
  );
  await execute(
    `UPDATE payment_selection_monitoring SET
       domestic_sales_count = NULL, added_reviews = NULL, title_optimized_at = NULL,
       qa_count = NULL, detail_optimized_at = NULL, material_selected = NULL,
       sku_optimized_at = NULL, campaign_name = '', concession_rate = NULL,
       quick_peak_done = NULL, abandoned = NULL, abandon_reason = '', abandon_at = NULL`
  );
  await execute(
    `UPDATE payment_selection_adjustment SET
       fee_ratio_7d = NULL, payers_7d = NULL, total_budget = NULL`
  );
  if (mode === 'mysql') {
    await execute("UPDATE payment_selection_adjustment SET client_key = CONCAT('legacy-', id) WHERE client_key IS NULL OR client_key = ''");
    try {
      await execute('CREATE UNIQUE INDEX uk_payment_adjustment_client ON payment_selection_adjustment(record_id, client_key)');
    } catch (error) {
      if (!String(error.message || '').toLowerCase().includes('duplicate')) throw error;
    }
  } else {
    await execute("UPDATE payment_selection_adjustment SET client_key = 'legacy-' || id WHERE client_key IS NULL OR client_key = ''");
    await execute(`CREATE UNIQUE INDEX IF NOT EXISTS uk_payment_adjustment_client
      ON payment_selection_adjustment(record_id, client_key)`);
  }
}

async function migratePaymentTracking({ execute, mode }) {
  if (typeof execute !== 'function') throw new Error('Payment tracking migration requires an execute function');
  if (!['sqlite', 'mysql'].includes(mode)) throw new Error(`Unsupported payment tracking database mode: ${mode}`);
  await ensureColumns(execute, mode);
  await ensureTestingRows(execute, mode);
  await migratePreparationData(execute);
  await migrateStageRows(execute, mode);
  await backfillSelectionDates(execute);
  await migrateMonitoringStatus(execute);
  await clearRetiredValues(execute, mode);
}

module.exports = { migratePaymentTracking };
