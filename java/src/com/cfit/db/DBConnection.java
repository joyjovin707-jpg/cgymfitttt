package com.cfit.db;

/**
 * Backward-compatibility wrapper for legacy references.
 * All core JDBC implementation files have been migrated to the new package:
 * {@link com.cfit.jdbc.DBConnection}.
 */
@Deprecated
public class DBConnection extends com.cfit.jdbc.DBConnection {
    // Inherits all static connection methods from com.cfit.jdbc.DBConnection
}
