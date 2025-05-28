import React, { useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; 
import './SettingsModal.css'; 

const SettingsModal = ({
    isOpen,
    onClose,
    onExportWordList,    // Function to call when "Export" is clicked
    isAdminMode,         // boolean: is admin mode currently active
    onToggleAdminMode,   // function: to toggle admin mode state
}) => {
    const modalDialogRef = useRef(null); 

    // Handle Escape key to close modal
    const handleEscapeKey = useCallback((event) => {
        if (event.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        } else {
            document.removeEventListener('keydown', handleEscapeKey);
        }
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, handleEscapeKey]);

    // Handle click outside to close
    const handleClickOutside = useCallback((event) => {
        if (modalDialogRef.current && !modalDialogRef.current.contains(event.target)) {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="search-modal-overlay" onClick={handleClickOutside}> 
            <div className="search-modal-content settings-modal-shell" ref={modalDialogRef} onClick={(e) => e.stopPropagation()}> 
                <div className="search-modal-header"> 
                    <h2>Settings</h2>
                    <button onClick={onClose} className="search-modal-close-btn">&times;</button>
                </div>
                <div className="settings-modal-scrollable-area"> 

                    <div className="settings-section">
                        <strong className="settings-section-title">Admin Configuration</strong>
                        <div className="setting-item">
                            <label htmlFor="adminModeToggle" className="admin-toggle-label">
                                <input
                                    type="checkbox"
                                    id="adminModeToggle"
                                    checked={isAdminMode}
                                    onChange={onToggleAdminMode}
                                    className="admin-toggle-checkbox"
                                />
                                Enable Admin Features
                            </label>
                            <p className="setting-description">
                                Shows extra options like data export. This setting is saved in your browser.
                            </p>
                        </div>
                    </div>

                    {isAdminMode && ( // Only show this section if admin mode is enabled
                        <div className="settings-section">
                            <strong className="settings-section-title">Data Management</strong>
                            <div className="setting-item">
                                <button 
                                    onClick={onExportWordList} 
                                    className="button-export-settings" // Specific class for styling
                                    title="Export current local word list to JSON"
                                >
                                    <span role="img" aria-label="export icon">📤</span> Export Word List
                                </button>
                                <p className="setting-description">
                                    Downloads your current word list (including all edits and new fields like notes, synonyms, category) as a JSON file.
                                    You should manually update the 'version' in the downloaded file before replacing your master `scrapedSpan411.json` and redeploying.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Placeholder for future settings */}
                    <div className="settings-section">
                        <strong className="settings-section-title">Appearance</strong>
                        <p className="setting-description"><em>(Theme options coming soon!)</em></p>
                    </div>

                </div>
                <div className="settings-modal-actions"> 
                     <button type="button" onClick={onClose} className="button-close-settings">Close</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;