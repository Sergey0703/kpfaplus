// src/webparts/kpfaplus/components/RemoteConnectionTest/RemoteConnectionTest.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { 
  SpinnerSize, 
  Spinner, 
  MessageBar, 
  MessageBarType, 
  PrimaryButton,
  DefaultButton,
  ProgressIndicator,
  Panel,
  PanelType,
  Text,
  Stack,
  Separator,
  Icon,
  Toggle,
  Dropdown,
  IDropdownOption,
  CommandBar,
  ICommandBarItemProps,
  Label
} from '@fluentui/react';
import { RemoteSiteService, IRemoteSiteInfo } from '../../services';
import { 
  DateMigrationService, 
  IListMigrationConfig, 
  IListMigrationState, 
  IMigrationResult,
  MigrationStatus
} from '../../services/DateMigrationService';
import { useDataContext } from '../../context';
import { IUserInfo } from '../../models/types';

export interface IRemoteConnectionTestProps {
  context: WebPartContext;
}

export const RemoteConnectionTest: React.FC<IRemoteConnectionTestProps> = (props) => {
  const { context } = props;
  
  // Get impersonation functionality from context
  const {
    impersonationState,
    startImpersonation,
    stopImpersonation,
    getEffectiveUser,
    getAllStaffForImpersonation
  } = useDataContext();
  
  // Connection test states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [siteInfo, setSiteInfo] = useState<IRemoteSiteInfo | null>(null);
  
  // --- NEW IMPERSONATION STATES ---
  const [availableStaff, setAvailableStaff] = useState<IUserInfo[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false);
  const [impersonationMessage, setImpersonationMessage] = useState<{text: string, type: MessageBarType} | null>(null);
  // --- END NEW IMPERSONATION STATES ---
  
  // Date migration states
  const [migrationService] = useState<DateMigrationService>(() => DateMigrationService.getInstance(context));
  const [availableLists] = useState<IListMigrationConfig[]>(() => migrationService.getAvailableLists());
  const [listStates, setListStates] = useState<{ [listName: string]: IListMigrationState }>({});
  const [showMigrationDetails, setShowMigrationDetails] = useState<boolean>(false);
  const [migrationResults, setMigrationResults] = useState<{ [listName: string]: IMigrationResult }>({});
  const [showResultsPanel, setShowResultsPanel] = useState<boolean>(false);
  const [selectedResultList, setSelectedResultList] = useState<string>('');

  // Initialize list states
  useEffect(() => {
    const initialStates: { [listName: string]: IListMigrationState } = {};
    
    availableLists.forEach(config => {
      initialStates[config.listName] = {
        listName: config.listName,
        status: 'notStarted',
        totalRecords: 0,
        processedRecords: 0,
        errorCount: 0
      };
    });
    
    setListStates(initialStates);
  }, [availableLists]);

  // --- NEW: Load available staff for impersonation ---
  useEffect(() => {
    const loadStaffForImpersonation = async (): Promise<void> => {
      try {
        setIsLoadingStaff(true);
        console.log('[RemoteConnectionTest] Loading staff for impersonation...');
        
        const staff = await getAllStaffForImpersonation();
        console.log(`[RemoteConnectionTest] Loaded ${staff.length} staff members for impersonation`);
        
        setAvailableStaff(staff);
      } catch (error) {
        console.error('[RemoteConnectionTest] Error loading staff for impersonation:', error);
        setImpersonationMessage({
          text: `Error loading staff: ${error}`,
          type: MessageBarType.error
        });
      } finally {
        setIsLoadingStaff(false);
      }
    };

    loadStaffForImpersonation()
      .then(() => console.log('[RemoteConnectionTest] Staff loading completed'))
      .catch(error => console.error('[RemoteConnectionTest] Staff loading failed:', error));
  }, [getAllStaffForImpersonation]);
  // --- NEW IMPERSONATION METHODS ---

  /**
   * Handles staff selection for impersonation
   */
  const handleStaffSelection = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (!option) return;

    const selectedStaffId = option.key as number;
    const selectedStaff = availableStaff.find(staff => staff.ID === selectedStaffId);
    
    if (selectedStaff) {
      console.log(`[RemoteConnectionTest] Starting impersonation of: ${selectedStaff.Title} (ID: ${selectedStaff.ID})`);
      
      startImpersonation(selectedStaff);
      
      setImpersonationMessage({
        text: `Now acting as: ${selectedStaff.Title} (${selectedStaff.Email})`,
        type: MessageBarType.success
      });

      // Clear message after 5 seconds
      setTimeout(() => {
        setImpersonationMessage(null);
      }, 5000);
    }
  };

  /**
   * Handles stopping impersonation
   */
  const handleStopImpersonation = (): void => {
    console.log('[RemoteConnectionTest] Stopping impersonation');
    
    const originalUser = impersonationState.originalUser;
    stopImpersonation();
    
    setImpersonationMessage({
      text: `Returned to original user: ${originalUser?.Title || 'Unknown'} (${originalUser?.Email || 'Unknown'})`,
      type: MessageBarType.info
    });

    // Clear message after 5 seconds
    setTimeout(() => {
      setImpersonationMessage(null);
    }, 5000);
  };

  /**
   * Gets command bar items for impersonation
   */
  const getImpersonationCommandBarItems = (): ICommandBarItemProps[] => {
    const items: ICommandBarItemProps[] = [];

    if (impersonationState.isImpersonating) {
      items.push({
        key: 'stopImpersonation',
        text: 'Stop Acting As',
        iconProps: { iconName: 'SignOut' },
        onClick: handleStopImpersonation,
        buttonStyles: {
          root: { backgroundColor: '#d83b01', color: 'white' },
          rootHovered: { backgroundColor: '#a4262c', color: 'white' }
        }
      });
    }

    items.push({
      key: 'refreshStaff',
      text: 'Refresh Staff List',
      iconProps: { iconName: 'Refresh' },
      onClick: () => {
        getAllStaffForImpersonation()
          .then(staff => {
            setAvailableStaff(staff);
            setImpersonationMessage({
              text: `Staff list refreshed (${staff.length} members)`,
              type: MessageBarType.info
            });
            setTimeout(() => setImpersonationMessage(null), 3000);
          })
          .catch(error => {
            setImpersonationMessage({
              text: `Error refreshing staff: ${error}`,
              type: MessageBarType.error
            });
          });
      }
    });

    return items;
  };

  /**
   * Gets dropdown options for staff selection
   */
  const getStaffDropdownOptions = (): IDropdownOption[] => {
    return availableStaff.map(staff => ({
      key: staff.ID,
      text: `${staff.Title} (${staff.Email})`,
      data: staff
    }));
  };

  // --- END NEW IMPERSONATION METHODS ---

  // Connection test function
  const testConnection = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setSiteInfo(null);
    
    try {
      const remoteSiteService = RemoteSiteService.getInstance(context);
      
      const siteInfoResult = await remoteSiteService.testRemoteSiteConnection();
      setSiteInfo(siteInfoResult);
      
      // Optional: Also check required lists for connection validation
      await remoteSiteService.checkAllRequiredLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze specific list
  const analyzeList = async (listName: string): Promise<void> => {
    try {
      // Update state to analyzing
      setListStates(prev => ({
        ...prev,
        [listName]: { ...prev[listName], status: 'analyzing' }
      }));

      const analysisResult = await migrationService.analyzeList(listName);
      
      setListStates(prev => ({
        ...prev,
        [listName]: analysisResult
      }));

    } catch (error) {
      setListStates(prev => ({
        ...prev,
        [listName]: {
          ...prev[listName],
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };

  // Migrate specific list
  const migrateList = async (listName: string): Promise<void> => {
    try {
      const result = await migrationService.migrateList(listName, (state) => {
        setListStates(prev => ({
          ...prev,
          [listName]: state
        }));
      });

      // Store migration result
      setMigrationResults(prev => ({
        ...prev,
        [listName]: result
      }));

      // Update final state
      setListStates(prev => ({
        ...prev,
        [listName]: {
          ...prev[listName],
          status: result.success ? 'completed' : 'error',
          errorMessage: result.success ? undefined : `${result.errorCount} errors occurred`
        }
      }));

    } catch (error) {
      setListStates(prev => ({
        ...prev,
        [listName]: {
          ...prev[listName],
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };

  // Show migration results
  const showResults = (listName: string): void => {
    setSelectedResultList(listName);
    setShowResultsPanel(true);
  };

  // Get status icon
  const getStatusIcon = (status: MigrationStatus): JSX.Element => {
    switch (status) {
      case 'notStarted':
        return <Icon iconName="CircleRing" style={{ color: '#605e5c' }} />;
      case 'analyzing':
        return <Spinner size={SpinnerSize.small} />;
      case 'ready':
        return <Icon iconName="CheckMark" style={{ color: '#107c10' }} />;
      case 'migrating':
        return <Spinner size={SpinnerSize.small} />;
      case 'completed':
        return <Icon iconName="Completed" style={{ color: '#107c10' }} />;
      case 'error':
        return <Icon iconName="ErrorBadge" style={{ color: '#d13438' }} />;
      default:
        return <Icon iconName="CircleRing" style={{ color: '#605e5c' }} />;
    }
  };

  // Get status text
  const getStatusText = (state: IListMigrationState): string => {
    switch (state.status) {
      case 'notStarted':
        return 'Not started';
      case 'analyzing':
        return 'Analyzing...';
      case 'ready':
        return `Ready (${state.totalRecords} records)`;
      case 'migrating':
        return `Migrating... (${state.processedRecords}/${state.totalRecords})`;
      case 'completed':
        return `Completed (${state.totalRecords} records)`;
      case 'error':
        return `Error: ${state.errorMessage}`;
      default:
        return 'Unknown';
    }
  };

  // Initial connection test
  useEffect(() => {
    testConnection()
      .then(() => console.log('Initial connection test completed'))
      .catch(error => console.error('Error during initial connection test:', error));
  }, []);
  // Get effective user for display
  const effectiveUser = getEffectiveUser();
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Remote Site Connection & Date Migration</h2>
      
      {/* --- NEW USER IMPERSONATION SECTION --- */}
      <div style={{ marginBottom: '30px' }}>
        <Stack tokens={{ childrenGap: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>User Impersonation</h3>
            <CommandBar
              items={getImpersonationCommandBarItems()}
              styles={{
                root: { padding: 0 }
              }}
            />
          </div>

          {/* Current User Status */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: impersonationState.isImpersonating ? '#fff4ce' : '#f3f2f1', 
            borderRadius: '4px',
            border: impersonationState.isImpersonating ? '1px solid #ffb900' : '1px solid #edebe9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Icon 
                iconName={impersonationState.isImpersonating ? "Contact" : "UserFollowed"} 
                style={{ 
                  color: impersonationState.isImpersonating ? '#ffb900' : '#0078d4',
                  fontSize: '16px' 
                }} 
              />
              <Text variant="mediumPlus" style={{ fontWeight: '600' }}>
                {impersonationState.isImpersonating ? 'Acting As' : 'Current User'}
              </Text>
            </div>
            
            <div style={{ marginLeft: '26px' }}>
              <div><strong>Name:</strong> {effectiveUser?.Title || 'Unknown'}</div>
              <div><strong>Email:</strong> {effectiveUser?.Email || 'Unknown'}</div>
              <div><strong>ID:</strong> {effectiveUser?.ID || 'Unknown'}</div>
              
              {impersonationState.isImpersonating && impersonationState.originalUser && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#605e5c' }}>
                  <strong>Original User:</strong> {impersonationState.originalUser.Title} ({impersonationState.originalUser.Email})
                </div>
              )}
            </div>
          </div>

          {/* Staff Selection */}
          <div>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
              Select Staff Member to Act As:
            </Label>
            
            {isLoadingStaff ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Spinner size={SpinnerSize.small} />
                <Text>Loading staff members...</Text>
              </div>
            ) : (
              <Dropdown
                placeholder="Choose a staff member..."
                options={getStaffDropdownOptions()}
                onChange={handleStaffSelection}
                disabled={isLoadingStaff || availableStaff.length === 0}
                styles={{
                  root: { maxWidth: '400px' },
                  dropdown: { 
                    backgroundColor: impersonationState.isImpersonating ? '#fff4ce' : 'white'
                  }
                }}
              />
            )}
            
            <Text variant="small" style={{ color: '#605e5c', marginTop: '5px', display: 'block' }}>
              {availableStaff.length > 0 
                ? `${availableStaff.length} staff members available for impersonation`
                : 'No staff members available'
              }
            </Text>
          </div>

          {/* Impersonation Status Message */}
          {impersonationMessage && (
            <MessageBar messageBarType={impersonationMessage.type}>
              {impersonationMessage.text}
            </MessageBar>
          )}

          {/* Usage Instructions */}
          <MessageBar messageBarType={MessageBarType.info}>
         <strong>How to use:</strong> Select a staff member from the dropdown to temporarily act as that user. 
All operations in the application will be performed with the selected user&apos;s identity. 
Click &quot;Stop Acting As&quot; to return to your original user account.
          </MessageBar>
        </Stack>
      </div>

      <Separator />
      {/* --- END NEW USER IMPERSONATION SECTION --- */}

      {/* CONNECTION TEST SECTION */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Connection Test</h3>
        
        {isLoading && (
          <div style={{ marginBottom: '20px' }}>
            <Spinner size={SpinnerSize.large} label="Testing connection to remote site..." />
          </div>
        )}
        
        {error && (
          <div style={{ marginBottom: '20px' }}>
            <MessageBar messageBarType={MessageBarType.error} isMultiline={true}>
              Error connecting to remote site: {error}
            </MessageBar>
          </div>
        )}
        
        {siteInfo && (
          <div style={{ marginBottom: '20px' }}>
            <h4>Remote Site Information</h4>
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>Site Title</td>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.title}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>URL</td>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.url}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>ID</td>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.id}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        
        <PrimaryButton
          text="Test Connection Again"
          onClick={() => {
            testConnection()
              .then(() => console.log('Connection test completed'))
              .catch(error => console.error('Error during connection test:', error));
          }}
          disabled={isLoading}
        />
      </div>

      <Separator />

      {/* DATE MIGRATION SECTION */}
      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Date Migration Tool</h3>
          <Toggle
            label="Show migration details"
            checked={showMigrationDetails}
            onChange={(_, checked) => setShowMigrationDetails(checked || false)}
            styles={{ root: { marginLeft: '20px' } }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <MessageBar messageBarType={MessageBarType.info}>
            <strong>Ireland Timezone Migration:</strong> This tool converts date fields from Ireland timezone to UTC format 
            for consistent data handling. Select individual lists to analyze and migrate.
          </MessageBar>
        </div>

        {/* LIST MIGRATION CONTROLS */}
        <div style={{ display: 'grid', gap: '15px' }}>
          {availableLists.map(config => {
            const state = listStates[config.listName];
            if (!state) return null;

            return (
              <div 
                key={config.listName}
                style={{ 
                  border: '1px solid #edebe9', 
                  borderRadius: '4px', 
                  padding: '15px',
                  backgroundColor: '#faf9f8'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getStatusIcon(state.status)}
                    <div>
                      <Text variant="mediumPlus" style={{ fontWeight: '600' }}>
                        {config.displayName}
                      </Text>
                      <div style={{ fontSize: '12px', color: '#605e5c' }}>
                        {getStatusText(state)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {state.status === 'notStarted' && (
                      <PrimaryButton
                        text="Analyze"
                        onClick={() => analyzeList(config.listName)}
                        disabled={false}
                        styles={{ root: { minWidth: '80px' } }}
                      />
                    )}
                    
                    {state.status === 'ready' && (
                      <>
                        <DefaultButton
                          text="Re-analyze"
                          onClick={() => analyzeList(config.listName)}
                          styles={{ root: { minWidth: '80px' } }}
                        />
                        <PrimaryButton
                          text="Migrate"
                          onClick={() => migrateList(config.listName)}
                          styles={{ root: { minWidth: '80px' } }}
                        />
                      </>
                    )}
                    
                    {state.status === 'completed' && (
                      <DefaultButton
                        text="View Results"
                        onClick={() => showResults(config.listName)}
                        styles={{ root: { minWidth: '80px' } }}
                      />
                    )}
                    
                    {state.status === 'error' && (
                      <>
                        <DefaultButton
                          text="Retry"
                          onClick={() => analyzeList(config.listName)}
                          styles={{ root: { minWidth: '80px' } }}
                        />
                        {migrationResults[config.listName] && (
                          <DefaultButton
                            text="View Errors"
                            onClick={() => showResults(config.listName)}
                            styles={{ root: { minWidth: '80px' } }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress indicator for migrating status */}
                {state.status === 'migrating' && (
                  <div style={{ marginBottom: '10px' }}>
                    <ProgressIndicator
                      percentComplete={state.totalRecords > 0 ? state.processedRecords / state.totalRecords : 0}
                      description={`Processing: ${state.processedRecords} of ${state.totalRecords} records`}
                    />
                  </div>
                )}

                {/* Show migration details if enabled */}
                {showMigrationDetails && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#605e5c' }}>
                    <div><strong>Estimated records:</strong> ~{config.estimatedCount.toLocaleString()}</div>
                    <div><strong>Date fields:</strong> {config.dateFields.length}</div>
                    <div style={{ marginTop: '5px' }}>
                      {config.dateFields.map(field => (
                        <div key={field.fieldName} style={{ marginLeft: '10px' }}>
                          • {field.fieldName} ({field.fieldType}) - {field.description}
                        </div>
                      ))}
                    </div>
                    
                    {state.previewRecords && state.previewRecords.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <strong>Preview (first {state.previewRecords.length} records):</strong>
                        {state.previewRecords.map((preview, index) => (
                          <div key={preview.id} style={{ 
                            marginLeft: '10px', 
                            marginTop: '5px',
                            fontSize: '11px',
                            backgroundColor: preview.needsUpdate ? '#fff4ce' : '#f3f2f1',
                            padding: '5px',
                            borderRadius: '2px'
                          }}>
                            <div><strong>Record {preview.id}:</strong> {preview.needsUpdate ? 'Needs update' : 'No changes needed'}</div>
                            {Object.keys(preview.originalDates).map(fieldName => (
                              <div key={fieldName} style={{ marginLeft: '10px' }}>
                                <strong>{fieldName}:</strong><br/>
                                Before: {preview.originalDates[fieldName]}<br/>
                                After: {preview.convertedDates[fieldName]}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* MIGRATION SUMMARY */}
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f3f2f1', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Migration Progress Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {Object.values(listStates).map(state => (
              <div key={state.listName} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {availableLists.find(c => c.listName === state.listName)?.displayName}
                </div>
                <div style={{ fontSize: '12px', color: '#605e5c' }}>
                  {state.status === 'completed' ? (
                    <span style={{ color: '#107c10' }}>✓ Complete</span>
                  ) : state.status === 'error' ? (
                    <span style={{ color: '#d13438' }}>✗ Error</span>
                  ) : state.status === 'migrating' ? (
                    <span style={{ color: '#0078d4' }}>⟳ Migrating</span>
                  ) : state.status === 'ready' ? (
                    <span style={{ color: '#107c10' }}>✓ Ready</span>
                  ) : state.status === 'analyzing' ? (
                    <span style={{ color: '#0078d4' }}>⟳ Analyzing</span>
                  ) : (
                    <span style={{ color: '#605e5c' }}>○ Not started</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MIGRATION RESULTS PANEL */}
      <Panel
        isOpen={showResultsPanel}
        onDismiss={() => setShowResultsPanel(false)}
        type={PanelType.medium}
        headerText={`Migration Results: ${availableLists.find(c => c.listName === selectedResultList)?.displayName}`}
        closeButtonAriaLabel="Close results panel"
      >
        {selectedResultList && migrationResults[selectedResultList] && (
          <div style={{ padding: '20px' }}>
            <Stack tokens={{ childrenGap: 15 }}>
              {/* Results Summary */}
              <div>
                <Text variant="large" style={{ fontWeight: '600', marginBottom: '10px', display: 'block' }}>
                  Migration Summary
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <strong>Status:</strong> {migrationResults[selectedResultList].success ? 
                      <span style={{ color: '#107c10' }}>Success</span> : 
                      <span style={{ color: '#d13438' }}>Failed</span>
                    }
                  </div>
                  <div>
                    <strong>Duration:</strong> {(migrationResults[selectedResultList].duration / 1000).toFixed(1)}s
                  </div>
                  <div>
                    <strong>Total Processed:</strong> {migrationResults[selectedResultList].totalProcessed.toLocaleString()}
                  </div>
                  <div>
                    <strong>Successful:</strong> {migrationResults[selectedResultList].successCount.toLocaleString()}
                  </div>
                  <div>
                    <strong>Errors:</strong> {migrationResults[selectedResultList].errorCount.toLocaleString()}
                  </div>
                  <div>
                    <strong>Success Rate:</strong> {migrationResults[selectedResultList].totalProcessed > 0 ? 
                      ((migrationResults[selectedResultList].successCount / migrationResults[selectedResultList].totalProcessed) * 100).toFixed(1) : 0
                    }%
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {migrationResults[selectedResultList].errors.length > 0 && (
                <div>
                  <Text variant="large" style={{ fontWeight: '600', marginBottom: '10px', display: 'block' }}>
                    Error Details ({migrationResults[selectedResultList].errors.length})
                  </Text>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto', 
                    backgroundColor: '#fdf6f6',
                    border: '1px solid #d13438',
                    borderRadius: '4px',
                    padding: '10px'
                  }}>
                    {migrationResults[selectedResultList].errors.map((error, index) => (
                      <div key={index} style={{ marginBottom: '5px', fontSize: '12px' }}>
                        {index + 1}. {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Data if Available */}
              {listStates[selectedResultList]?.previewRecords && listStates[selectedResultList].previewRecords!.length > 0 && (
                <div>
                  <Text variant="large" style={{ fontWeight: '600', marginBottom: '10px', display: 'block' }}>
                    Sample Conversions
                  </Text>
                  <div style={{ fontSize: '12px' }}>
                    {listStates[selectedResultList].previewRecords!.map((preview, index) => (
                      <div key={preview.id} style={{ 
                        marginBottom: '10px', 
                        padding: '10px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #edebe9',
                        borderRadius: '4px'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '5px' }}>
                          Record ID: {preview.id}
                        </div>
                        {Object.keys(preview.originalDates).map(fieldName => (
                          <div key={fieldName} style={{ marginBottom: '5px' }}>
                            <strong>{fieldName}:</strong><br/>
                            <span style={{ color: '#d13438' }}>Before:</span> {preview.originalDates[fieldName]}<br/>
                            <span style={{ color: '#107c10' }}>After:</span> {preview.convertedDates[fieldName]}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Stack>
          </div>
        )}
      </Panel>
    </div>
  );
};