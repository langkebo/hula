import { logger } from './src/utils/Logger.ts';

// Mock some environments for testing
// @ts-ignore
global.import = { meta: { env: { DEV: true } } };

function testRedaction() {
    console.log('--- Testing Logger Redaction ---');

    const sensitiveData = {
        user: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '13812345678',
            password: 'mySecretPassword123'
        },
        session: {
            access_token: 'syt_some_long_matrix_token_value',
            refresh_token: 'refresh_1234567890',
            sid: 'session_id_abcdef'
        }
    };

    console.log('Logging sensitive object:');
    logger.info('User login attempt', sensitiveData);

    console.log('\nLogging sensitive string:');
    logger.warn('Failed request with token: access_token="syt_123456789" and email: test@example.com');

    console.log('\nLogging deep object:');
    logger.debug('System state', {
        config: {
            auth: {
                key: 'very-secret-key-do-not-log'
            }
        }
    });
}

// Since Logger.ts depends on @tauri-apps/plugin-log, we might need to mock it if running in node
// For now, I'll just check if I can run it or if I should just trust the logic.
// Actually, let's just use evaluate in Playwright to test it in a real browser environment.
