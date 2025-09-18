// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSMessagePanel.tsx

import * as React from 'react';
import { MessageBar, MessageBarType, IconButton } from '@fluentui/react';

export interface ISRSMessagePanelProps {
  message?: string;
  messageType: 'success' | 'error' | 'warning' | 'info';
  onDismiss: () => void;
  isVisible: boolean;
  details?: string[];
}

/**
 * Message panel component for showing SRS export results
 * Displays above the SRS table with success/error information
 */
export const SRSMessagePanel: React.FC<ISRSMessagePanelProps> = ({
  message,
  messageType,
  onDismiss,
  isVisible,
  details
}) => {
  
  if (!isVisible || !message) {
    return null;
  }

  // Map our message types to Fluent UI MessageBarType
  const getMessageBarType = (): MessageBarType => {
    switch (messageType) {
      case 'success':
        return MessageBarType.success;
      case 'error':
        return MessageBarType.error;
      case 'warning':
        return MessageBarType.warning;
      case 'info':
      default:
        return MessageBarType.info;
    }
  };

  const getMessageIcon = (): string => {
    switch (messageType) {
      case 'success':
        return 'CheckMark';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
      default:
        return 'Info';
    }
  };

  console.log('[SRSMessagePanel] Rendering message panel:', {
    messageType,
    message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    hasDetails: !!details && details.length > 0,
    detailsCount: details?.length || 0
  });

  return (
    <div style={{ 
      marginBottom: '16px',
      border: messageType === 'error' ? '1px solid #d13438' : 
             messageType === 'success' ? '1px solid #107c10' :
             messageType === 'warning' ? '1px solid #ffb900' : '1px solid #0078d4',
      borderRadius: '4px'
    }}>
      <MessageBar
        messageBarType={getMessageBarType()}
        isMultiline={true}
        onDismiss={onDismiss}
        dismissButtonAriaLabel="Close message"
        styles={{
          root: {
            borderRadius: '4px'
          },
          content: {
            padding: '12px 16px'
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontWeight: '600', 
              marginBottom: details && details.length > 0 ? '8px' : '0',
              fontSize: '14px'
            }}>
              {message}
            </div>
            
            {/* Show details if available */}
            {details && details.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <details>
                  <summary style={{ 
                    cursor: 'pointer',
                    fontWeight: '500',
                    color: '#666',
                    fontSize: '13px',
                    marginBottom: '4px'
                  }}>
                    Show details ({details.length} items)
                  </summary>
                  <div style={{ 
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'Consolas, Monaco, monospace'
                  }}>
                    {details.map((detail, index) => (
                      <div key={index} style={{ 
                        marginBottom: index < details.length - 1 ? '4px' : '0',
                        wordBreak: 'break-word'
                      }}>
                        {index + 1}. {detail}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </MessageBar>
    </div>
  );
};

/**
 * Helper function to create success message data
 */
export const createSRSSuccessMessage = (
  recordsProcessed: number,
  processingTime?: number,
  cellsUpdated?: number
): { message: string; details: string[] } => {
  const message = `SRS Export Successful! Processed ${recordsProcessed} record${recordsProcessed !== 1 ? 's' : ''}.`;
  
  const details: string[] = [
    `Records processed: ${recordsProcessed}`,
  ];
  
  if (cellsUpdated !== undefined) {
    details.push(`Excel cells updated: ${cellsUpdated}`);
  }
  
  if (processingTime !== undefined) {
    details.push(`Processing time: ${processingTime}ms`);
  }
  
  details.push(`Export completed at: ${new Date().toLocaleTimeString()}`);
  
  return { message, details };
};

/**
 * Helper function to create error message data
 */
export const createSRSErrorMessage = (
  error: string,
  operation?: string,
  additionalDetails?: string[]
): { message: string; details: string[] } => {
  const message = `SRS Export Failed: ${error}`;
  
  const details: string[] = [
    `Error: ${error}`,
  ];
  
  if (operation) {
    details.push(`Failed operation: ${operation}`);
  }
  
  if (additionalDetails && additionalDetails.length > 0) {
    details.push(...additionalDetails);
  }
  
  details.push(`Error occurred at: ${new Date().toLocaleTimeString()}`);
  
  return { message, details };
};

/**
 * Helper function to create warning message data
 */
export const createSRSWarningMessage = (
  warning: string,
  suggestions?: string[]
): { message: string; details: string[] } => {
  const message = `SRS Export Warning: ${warning}`;
  
  const details: string[] = [
    `Warning: ${warning}`,
  ];
  
  if (suggestions && suggestions.length > 0) {
    details.push('Suggestions:');
    suggestions.forEach(suggestion => {
      details.push(`• ${suggestion}`);
    });
  }
  
  details.push(`Warning at: ${new Date().toLocaleTimeString()}`);
  
  return { message, details };
};