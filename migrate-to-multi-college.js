import { auth, db } from "./firebase.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/**
 * Migration Script for Multi-College Support
 * 
 * This script migrates existing single-college data to multi-college structure
 * 
 * Steps:
 * 1. Create a default college entry
 * 2. Update all existing users with the default college ID
 * 3. Update all existing collections with college context
 * 
 * WARNING: Run this script only once and backup your data first!
 */

const DEFAULT_COLLEGE = {
    name: "Default College",
    code: "DEFAULT",
    email: "admin@defaultcollege.edu",
    address: "Update this address",
    phone: "+1234567890",
    website: "",
    gpsSettings: {
        latitude: null,
        longitude: null,
        radius: 100
    },
    settings: {
        timezone: "Asia/Kolkata",
        academicYear: "2024-25",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        sessionTimings: {
            forenoon: { start: "09:00", end: "12:00" },
            afternoon: { start: "13:00", end: "16:00" }
        }
    },
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
};

let defaultCollegeId = null;

async function createDefaultCollege() {
    console.log("Creating default college...");
    
    try {
        // Check if default college already exists
        const existingQuery = query(collection(db, "colleges"), where("code", "==", "DEFAULT"));
        const existingSnap = await getDocs(existingQuery);
        
        if (!existingSnap.empty) {
            defaultCollegeId = existingSnap.docs[0].id;
            console.log("Default college already exists:", defaultCollegeId);
            return defaultCollegeId;
        }
        
        // Create default college
        const collegeRef = await addDoc(collection(db, "colleges"), DEFAULT_COLLEGE);
        defaultCollegeId = collegeRef.id;
        
        console.log("Default college created:", defaultCollegeId);
        return defaultCollegeId;
        
    } catch (error) {
        console.error("Error creating default college:", error);
        throw error;
    }
}

async function migrateUsers() {
    console.log("Migrating users...");
    
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        let updateCount = 0;
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            
            // Skip if already has collegeId
            if (userData.collegeId) {
                continue;
            }
            
            // Add college information
            const userRef = doc(db, "users", userDoc.id);
            batch.update(userRef, {
                collegeId: defaultCollegeId,
                collegeName: DEFAULT_COLLEGE.name,
                updatedAt: serverTimestamp()
            });
            
            updateCount++;
            
            // Commit batch every 500 operations (Firestore limit)
            if (updateCount % 500 === 0) {
                await batch.commit();
                console.log(`Updated ${updateCount} users so far...`);
            }
        }
        
        // Commit remaining operations
        if (updateCount % 500 !== 0) {
            await batch.commit();
        }
        
        console.log(`Successfully migrated ${updateCount} users`);
        
    } catch (error) {
        console.error("Error migrating users:", error);
        throw error;
    }
}

async function migrateCollection(collectionName, batchSize = 500) {
    console.log(`Migrating ${collectionName}...`);
    
    try {
        const collectionSnap = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        let updateCount = 0;
        
        for (const docSnapshot of collectionSnap.docs) {
            const docData = docSnapshot.data();
            
            // Skip if already has collegeId
            if (docData.collegeId) {
                continue;
            }
            
            // Add college information
            const docRef = doc(db, collectionName, docSnapshot.id);
            batch.update(docRef, {
                collegeId: defaultCollegeId,
                updatedAt: serverTimestamp()
            });
            
            updateCount++;
            
            // Commit batch every batchSize operations
            if (updateCount % batchSize === 0) {
                await batch.commit();
                console.log(`Updated ${updateCount} ${collectionName} documents so far...`);
            }
        }
        
        // Commit remaining operations
        if (updateCount % batchSize !== 0) {
            await batch.commit();
        }
        
        console.log(`Successfully migrated ${updateCount} ${collectionName} documents`);
        
    } catch (error) {
        console.error(`Error migrating ${collectionName}:`, error);
        throw error;
    }
}

async function runMigration() {
    console.log("Starting multi-college migration...");
    console.log("WARNING: This will modify your database. Make sure you have a backup!");
    
    if (!confirm("Are you sure you want to run the migration? This cannot be undone.")) {
        console.log("Migration cancelled by user");
        return;
    }
    
    try {
        // Step 1: Create default college
        await createDefaultCollege();
        
        // Step 2: Migrate users
        await migrateUsers();
        
        // Step 3: Migrate other collections
        const collectionsToMigrate = [
            "attendanceRecords",
            "attendanceSettings", 
            "manualRequests",
            "permissionRequests",
            "notifications",
            "holidays",
            "settings",
            "profileUpdateRequests"
        ];
        
        for (const collectionName of collectionsToMigrate) {
            try {
                await migrateCollection(collectionName);
            } catch (error) {
                console.warn(`Failed to migrate ${collectionName}:`, error);
                // Continue with other collections
            }
        }
        
        console.log("✅ Migration completed successfully!");
        console.log(`Default college ID: ${defaultCollegeId}`);
        console.log("Next steps:");
        console.log("1. Update the default college information in the college management system");
        console.log("2. Create additional colleges as needed");
        console.log("3. Test the multi-college functionality");
        
    } catch (error) {
        console.error("❌ Migration failed:", error);
        alert("Migration failed. Check console for details.");
    }
}

// Export functions for ES6 modules
export { createDefaultCollege, migrateUsers, migrateCollection };

// Export functions for manual use
window.runMigration = runMigration;
window.createDefaultCollege = createDefaultCollege;
window.migrateUsers = migrateUsers;
window.migrateCollection = migrateCollection;

// Auto-run if this script is loaded directly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("Migration script loaded. Run 'runMigration()' in console to start.");
    });
} else {
    console.log("Migration script loaded. Run 'runMigration()' in console to start.");
}