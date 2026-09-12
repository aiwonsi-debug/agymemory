const fs = require('fs');
const path = require('path');
const groundTruthValidator = require('./ground_truth_validator.js');

jest.mock('fs');
jest.mock('xlsx');
jest.mock('./tns_order_parser.js', () => ({
    findLatestTNSFile: jest.fn(),
    extractTNSOrders: jest.fn()
}), { virtual: true });

const parser = require('./tns_order_parser.js');
const xlsx = require('xlsx');

describe('GroundTruthValidator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        groundTruthValidator.cache = null;
        groundTruthValidator.lastParsed = 0;
    });

    describe('loadGroundTruth', () => {
        it('should load TNS orders successfully', () => {
            parser.findLatestTNSFile.mockReturnValue('tns.xlsx');
            fs.existsSync.mockImplementation(p => p === 'tns.xlsx');
            fs.statSync.mockReturnValue({ mtime: new Date('2026-09-01T00:00:00Z') });
            parser.extractTNSOrders.mockReturnValue([
                { sheet: 'Sep-26', product: 'Test Product', qty: 10, unit: 'kg', date: '2026-09-01', day: '01', month: '09', year: '2026' },
                { sheet: 'Oct-26', product: 'Ignore', qty: 5, unit: 'kg', date: '2026-10-01', day: '01', month: '10', year: '2026' }
            ]);

            const records = groundTruthValidator.loadGroundTruth();
            const tnsRecords = records.filter(r => r.customer === 'TNS');

            expect(tnsRecords.length).toBe(1);
            expect(tnsRecords[0].product).toBe('Test Product');
            expect(tnsRecords[0].qty).toBe(10);
            expect(tnsRecords[0].date).toBe('2026-09-01');
            expect(tnsRecords[0].verified).toBe(true);
        });

        it('should load AFT deliveries successfully', () => {
            const masterFile = path.join('E:\\รวมงาน\\งาน 25-26', 'Master_Order_Schedule_2026.xlsx');
            fs.existsSync.mockImplementation(p => p === masterFile);
            fs.statSync.mockReturnValue({ mtime: new Date('2026-09-01T00:00:00Z') });

            const records = groundTruthValidator.loadGroundTruth();
            const aftRecords = records.filter(r => r.customer === 'AFT');

            expect(aftRecords.length).toBeGreaterThan(0);
            expect(aftRecords[0].product).toBe('กะหล่ำปลี');
            expect(aftRecords[0].qty).toBe(2500);
            expect(aftRecords[0].date).toBe('2026-09-01');
        });

        it('should load Yamamori POs successfully', () => {
            const yamamoriDir = path.join('E:\\รวมงาน\\งาน 25-26', 'Siam Yamamori', 'PO');
            const carrotFile = path.join(yamamoriDir, 'carrot.xlsx');

            fs.existsSync.mockImplementation(p => p === yamamoriDir || p === carrotFile);

            xlsx.readFile.mockReturnValue({
                SheetNames: ['Sep'],
                Sheets: { 'Sep': {} }
            });
            xlsx.utils = {
                sheet_to_json: jest.fn().mockReturnValue([
                    { Item_Description: 'Carrot', Quantity: '100', Delivery_Date: '15/09/26', PO_Number: 'PO-123', Source_File: 'carrot_po.pdf' }
                ])
            };

            const records = groundTruthValidator.loadGroundTruth();
            const yamamoriRecords = records.filter(r => r.customer === 'Siam Yamamori');

            // Should contain the default fallback items plus the one mocked
            expect(yamamoriRecords.length).toBeGreaterThan(4);

            const mockedRecord = yamamoriRecords.find(r => r.ref === 'PO-123');
            expect(mockedRecord).toBeDefined();
            expect(mockedRecord.product).toBe('แครอท');
            expect(mockedRecord.qty).toBe(100);
            expect(mockedRecord.date).toBe('2026-09-15');
        });

        it('should use cached data if called within 60 seconds', () => {
            const now = Date.now();
            groundTruthValidator.cache = [{ mock: 'data' }];
            groundTruthValidator.lastParsed = now - 10000; // 10 seconds ago

            const records = groundTruthValidator.loadGroundTruth();

            expect(records).toEqual([{ mock: 'data' }]);

            // Ensure no fs calls were made since it hit cache
            expect(fs.existsSync).not.toHaveBeenCalled();
        });
    });

    describe('queryGroundTruth', () => {
        beforeEach(() => {
            // Mock loadGroundTruth to return a predictable set of records
            jest.spyOn(groundTruthValidator, 'loadGroundTruth').mockReturnValue([
                { customer: 'TNS', customerFull: 'Thai Nisshin Seifun (TNS)', product: 'แครอท', date: '2026-09-01' },
                { customer: 'AFT', customerFull: 'Ajinomoto Frozen Foods', product: 'กะหล่ำปลี', date: '2026-09-03' },
                { customer: 'Siam Yamamori', customerFull: 'Siam Yamamori Co., Ltd.', product: 'หอมหัวใหญ่', date: '2026-09-05' }
            ]);
        });

        it('should filter by customer (partial match, case insensitive)', () => {
            const results = groundTruthValidator.queryGroundTruth('tns', null, null);
            expect(results.length).toBe(1);
            expect(results[0].customer).toBe('TNS');

            const resultsFull = groundTruthValidator.queryGroundTruth('ajinomoto', null, null);
            expect(resultsFull.length).toBe(1);
            expect(resultsFull[0].customer).toBe('AFT');
        });

        it('should filter by product (partial match, case insensitive)', () => {
            const results = groundTruthValidator.queryGroundTruth(null, 'แครอท', null);
            expect(results.length).toBe(1);
            expect(results[0].product).toBe('แครอท');
        });

        it('should filter by date (exact match string)', () => {
            const results = groundTruthValidator.queryGroundTruth(null, null, '2026-09-05');
            expect(results.length).toBe(1);
            expect(results[0].date).toBe('2026-09-05');
        });

        it('should filter by multiple criteria', () => {
            const results = groundTruthValidator.queryGroundTruth('AFT', 'กะหล่ำปลี', '2026-09-03');
            expect(results.length).toBe(1);
            expect(results[0].customer).toBe('AFT');
            expect(results[0].product).toBe('กะหล่ำปลี');
            expect(results[0].date).toBe('2026-09-03');

            const noMatch = groundTruthValidator.queryGroundTruth('AFT', 'แครอท', '2026-09-03');
            expect(noMatch.length).toBe(0);
        });
    });

    describe('buildGroundTruthContext', () => {
        beforeEach(() => {
            jest.spyOn(groundTruthValidator, 'loadGroundTruth').mockReturnValue([
                { customer: 'TNS', sourceFile: 'tns.xlsx', product: 'แครอท', qty: 10, unit: 'กก.', date: '2026-09-01' },
                { customer: 'TNS', sourceFile: 'tns.xlsx', product: 'หอมหัวใหญ่', qty: 20, unit: 'กก.', date: '2026-09-01' },
                { customer: 'AFT', sourceFile: 'aft.xlsx', product: 'กะหล่ำปลี', qty: 2500, unit: 'กก.', date: '2026-09-03' }
            ]);
        });

        it('should format output header correctly', () => {
            const context = groundTruthValidator.buildGroundTruthContext();
            expect(context).toContain('🔒 [STRICT GROUND-TRUTH DATA - ตรวจสอบตรงจากไฟล์และอีเมลจริงล่าสุด 100%]:');
            expect(context).toContain('⚠️ กฎเหล็ก: ห้ามสมมติหรือสร้างตัวเลขขึ้นมาเองเด็ดขาด ให้ใช้เฉพาะข้อมูลที่ระบุด้านล่างนี้เท่านั้น');
        });

        it('should group records by customer and date', () => {
            const context = groundTruthValidator.buildGroundTruthContext();

            // Check TNS grouping
            expect(context).toContain('🏢 ลูกค้า: TNS (ไฟล์อ้างอิง: tns.xlsx)');
            expect(context).toContain('• วันที่ 2026-09-01: แครอท 10 กก., หอมหัวใหญ่ 20 กก.');

            // Check AFT grouping
            expect(context).toContain('🏢 ลูกค้า: AFT (ไฟล์อ้างอิง: aft.xlsx)');
            expect(context).toContain('• วันที่ 2026-09-03: กะหล่ำปลี 2,500 กก.');
        });
    });
});
