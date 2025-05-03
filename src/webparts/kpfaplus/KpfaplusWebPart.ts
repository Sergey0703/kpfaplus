import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

// Use string keys for localization strings
const strings = {
  PropertyPaneDescription: "Description",
  BasicGroupName: "Group Name",
  DescriptionFieldLabel: "Description Field",
  AppLocalEnvironmentSharePoint: "The app is running on a local environment as SharePoint web part",
  AppLocalEnvironmentTeams: "The app is running on a local environment as Microsoft Teams app",
  AppSharePointEnvironment: "The app is running on SharePoint page",
  AppTeamsTabEnvironment: "The app is running in Microsoft Teams"
};

import KPFA from './components/KPFA';
// Исправляем импорт для соответствия регистру имени файла
import { IKPFAProps } from './components/IKPFAprops';

// Import our department service
import { DepartmentService, IDepartment } from './services/DepartmentService';

export interface IKPFAPlusWebPartProps {
  description: string;
}

export default class KPFAPlusWebPart extends BaseClientSideWebPart<IKPFAPlusWebPartProps> {
  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';
  private departmentService: DepartmentService;
  private departments: IDepartment[] = [];
  private defaultDepartment: IDepartment | null = null;

  protected async onInit(): Promise<void> {
    await super.onInit();
    
    // Initialize our environment message
    this._environmentMessage = this._getEnvironmentMessage();
    
    // Initialize the department service
    this.departmentService = new DepartmentService(this.context);
    
    // Fetch departments on component initialization
    try {
      await this.fetchDepartments();
    } catch (error) {
      console.error("Error initializing departments:", error);
    }
  }

  /**
   * Fetch departments from Power Automate flow
   */
  private async fetchDepartments(): Promise<void> {
    try {
      this.departments = await this.departmentService.fetchDepartments();
      
      // Filter out deleted departments if needed
      const activeDepartments: IDepartment[] = [];
      
      // Используем цикл for вместо filter() для обратной совместимости с ES5
      for (let i = 0; i < this.departments.length; i++) {
        if (!this.departments[i].Deleted) {
          activeDepartments.push(this.departments[i]);
        }
      }
      
      // Set default department if available
      if (activeDepartments && activeDepartments.length > 0) {
        this.defaultDepartment = activeDepartments[0];
      }
      
      // Re-render the component with the updated data
      this.render();
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  }

  public render(): void {
    const element: React.ReactElement<IKPFAProps> = React.createElement(
      KPFA,
      {
        description: this.properties.description,
        isDarkTheme: this._isDarkTheme,
        environmentMessage: this._environmentMessage,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        userDisplayName: this.context.pageContext.user.displayName,
        // Pass departments data to the component
        departments: this.departments,
        defaultDepartment: this.defaultDepartment
      }
    );

    ReactDom.render(element, this.domElement);
  }

  private _getEnvironmentMessage(): string {
    if (!!this.context.sdks.microsoftTeams) { // running in Teams
      return this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentTeams : strings.AppTeamsTabEnvironment;
    }

    return this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentSharePoint : strings.AppSharePointEnvironment;
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || '');
      this.domElement.style.setProperty('--link', semanticColors.link || '');
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || '');
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}