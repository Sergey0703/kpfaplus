// src/webparts/kpfaplus/components/ResizableLayout/ResizableLayout.tsx
import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { IconButton, TooltipHost } from '@fluentui/react';

interface IResizableLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  defaultLeftWidth?: number;
  collapsedWidth?: number;
  showCollapseButton?: boolean;
}

export const ResizableLayout: React.FC<IResizableLayoutProps> = ({
  leftPanel,
  rightPanel,
  minLeftWidth = 180,
  maxLeftWidth = 500,
  defaultLeftWidth = 250,
  collapsedWidth = 36,
  showCollapseButton = true
}) => {
  const [leftWidth, setLeftWidth] = useState<number>(defaultLeftWidth);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showPulse, setShowPulse] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Убираем пульсацию через 3 секунды после первого рендера
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPulse(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    
    // Определяем, должна ли панель быть свернута
    if (newWidth <= collapsedWidth * 2) {
      setLeftWidth(collapsedWidth);
      setIsCollapsed(true);
    } else {
      // Ограничиваем в пределах min/max bounds
      const constrainedWidth = Math.min(Math.max(newWidth, minLeftWidth), maxLeftWidth);
      setLeftWidth(constrainedWidth);
      setIsCollapsed(false);
    }
  }, [isResizing, minLeftWidth, maxLeftWidth, collapsedWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Обработчик кнопки сворачивания/разворачивания
  const handleToggleCollapse = useCallback(() => {
    if (isCollapsed) {
      setLeftWidth(defaultLeftWidth);
      setIsCollapsed(false);
    } else {
      setLeftWidth(collapsedWidth);
      setIsCollapsed(true);
    }
    setShowPulse(false); // Убираем пульсацию после первого взаимодействия
  }, [isCollapsed, defaultLeftWidth, collapsedWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Стили для кнопки сворачивания в заголовке
  const headerButtonStyles = {
    root: {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      backgroundColor: '#0078d4',
      border: 'none',
      boxShadow: showPulse ? '0 0 0 4px rgba(0, 120, 212, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
      animation: showPulse ? 'pulse 2s infinite' : 'none',
      transition: 'all 0.2s ease',
      marginLeft: '8px'
    },
    rootHovered: {
      backgroundColor: '#106ebe',
      transform: 'scale(1.05)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
    },
    icon: {
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: 'bold'
    }
  };

  // Стили для большой кнопки в свернутой панели
  const collapsedButtonStyles = {
    root: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      backgroundColor: '#0078d4',
      border: 'none',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      transition: 'all 0.2s ease'
    },
    rootHovered: {
      backgroundColor: '#106ebe',
      transform: 'scale(1.1)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
    },
    icon: {
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: 'bold'
    }
  };

  return (
    <>
      {/* CSS анимация для пульсации */}
      <style>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 120, 212, 0.4);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(0, 120, 212, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 120, 212, 0);
          }
        }
      `}</style>

      <div 
        ref={containerRef}
        style={{ 
          display: 'flex', 
          width: '100%', 
          height: '100%', 
          overflow: 'hidden' 
        }}
      >
        {/* Left Panel */}
        <div style={{ 
          width: `${leftWidth}px`,
          minWidth: `${leftWidth}px`,
          height: '100%',
          backgroundColor: isCollapsed ? 'linear-gradient(135deg, #f0f6ff 0%, #deecf9 100%)' : '#f0f6ff',
          background: isCollapsed ? 'linear-gradient(135deg, #f0f6ff 0%, #deecf9 100%)' : '#f0f6ff',
          borderRight: isCollapsed ? 'none' : '1px solid #ddd',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: isResizing ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative'
        }}>
          {/* Содержимое развернутой панели */}
          {!isCollapsed && (
            <>
              {/* Заголовок с кнопкой сворачивания */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 10px 5px 10px',
                flexShrink: 0,
                borderBottom: '1px solid #e1e5e9',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <span style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#323130'
                }}>
                  Staff Members
                </span>
                
                {showCollapseButton && (
                  <TooltipHost content="Collapse staff panel">
                    <IconButton
                      iconProps={{ iconName: 'ChevronLeft' }}
                      onClick={handleToggleCollapse}
                      styles={headerButtonStyles}
                      ariaLabel="Collapse staff panel"
                    />
                  </TooltipHost>
                )}
              </div>
              
              {/* Основное содержимое панели */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {leftPanel}
              </div>
            </>
          )}
          
          {/* Свернутая панель */}
          {isCollapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              cursor: 'pointer',
              position: 'relative'
            }}>
              {/* Декоративные элементы */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '2px',
                height: '60px',
                background: 'linear-gradient(to bottom, transparent, #0078d4, transparent)',
                borderRadius: '1px'
              }} />
              
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '2px',
                height: '60px',
                background: 'linear-gradient(to bottom, transparent, #0078d4, transparent)',
                borderRadius: '1px'
              }} />
              
              {/* Главная кнопка разворачивания */}
              <TooltipHost content="Expand staff panel">
                <IconButton
                  iconProps={{ iconName: 'ChevronRight' }}
                  onClick={handleToggleCollapse}
                  styles={collapsedButtonStyles}
                  ariaLabel="Expand staff panel"
                />
              </TooltipHost>
            </div>
          )}
        </div>
        
        {/* Resizer - показываем только если панель развернута */}
        {!isCollapsed && (
          <div
            style={{
              width: '3px',
              height: '100%',
              backgroundColor: isResizing ? '#0078d4' : 'transparent',
              cursor: 'col-resize',
              userSelect: 'none',
              position: 'relative',
              transition: isResizing ? 'none' : 'background-color 0.2s ease',
              borderLeft: '1px solid #e1e5e9',
              borderRight: '1px solid #e1e5e9'
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Видимый индикатор только при наведении */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '1px',
              height: '30px',
              backgroundColor: '#c8c6c4',
              borderRadius: '1px',
              opacity: isResizing ? 1 : 0,
              transition: 'opacity 0.2s ease'
            }} />
          </div>
        )}
        
        {/* Right Panel */}
        <div style={{ 
          flex: 1, 
          height: '100%', 
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          minWidth: '300px'
        }}>
          {rightPanel}
        </div>
      </div>
    </>
  );
};