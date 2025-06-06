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
  Toggle
} from '@fluentui/react';
import { RemoteSiteService, IRemoteSiteInfo } from '../../services';
import { 
  DateMigrationService, 
  IListMigrationConfig, 
  IListMigrationState, 
  IMigrationResult,
  MigrationStatus
} from '../../services/DateMigrationService';

export interface IRemoteConnectionTestProps {
  context: WebPartContext;
}

export const RemoteConnectionTest: React.FC<IRemoteConnectionTestProps> = (props) => {
  const { context } = props;
  
  // Connection test states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [siteInfo, setSiteInfo] = useState<IRemoteSiteInfo | null>(null);
  
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
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Remote Site Connection & Date Migration</h2>
      
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